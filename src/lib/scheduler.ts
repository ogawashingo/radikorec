import cron from 'node-cron';
import { format, getHours, getMinutes, getDay, addMinutes, differenceInMinutes } from 'date-fns';
import { drizzleDb } from '@/lib/db';
import { schedules as schedulesTable } from '@/lib/schema';
import { eq, and, isNull, lte, inArray } from 'drizzle-orm';
import { recordRadiko } from '@/lib/recorder';
import { sendDiscordNotification, formatFileSize } from '@/lib/notifier';
import { scanAndReserve } from '@/lib/scanner';
import { logger } from '@/lib/logger';

// 開発中の重複初期化を防ぐためのグローバル参照
declare global {
    var isSchedulerRunning: boolean | undefined;
}

import { Schedule } from '@/types';

export function initScheduler() {
    if (globalThis.isSchedulerRunning) {
        logger.info('Scheduler already running (skipping re-init).');
        return;
    }

    logger.info('Starting Scheduler...');
    globalThis.isSchedulerRunning = true;

    // 毎日のキーワードスキャン (04:00 JST)
    cron.schedule('0 4 * * *', async () => {
        logger.info('Running daily keyword scan...');
        try {
            await scanAndReserve();
        } catch (e) {
            logger.error({ error: e }, 'Keyword scan failed:');
        }
    }, {
        timezone: "Asia/Tokyo"
    });

    // 1分ごとに実行
    cron.schedule('* * * * *', async () => {
        // Dockerコンテナは現在JST (TZ=Asia/Tokyo) に設定されています
        // そのため、new Date()は正しいローカル時刻を返します。手動でのオフセットは不要です。
        const jstNow = new Date();

        // date-fns を使用して現在時刻をフォーマット
        const localNowStr = format(jstNow, "yyyy-MM-dd'T'HH:mm");
        const currentDayOfWeek = getDay(jstNow); // 0(日) - 6(土)


        // 1. ワンタイム予約 (pending かつ 過去)
        const pendingSchedules = drizzleDb.select().from(schedulesTable)
            .where(and(
                eq(schedulesTable.status, 'pending'),
                isNull(schedulesTable.recurring_pattern),
                lte(schedulesTable.start_time, localNowStr)
            )).all();

        // 2. 毎週予約 (weekly)
        const prevDayOfWeek = (currentDayOfWeek - 1 + 7) % 7;
        const weeklySchedules = drizzleDb.select().from(schedulesTable)
            .where(and(
                eq(schedulesTable.recurring_pattern, 'weekly'),
                inArray(schedulesTable.day_of_week, [currentDayOfWeek, prevDayOfWeek])
            )).all();

        // 両方を結合してチェック
        // 今日のワンタイム予約（pending）とすべての毎週予約
        // 以下に基づいてフィルタリングします：
        // - リアルタイム：開始時刻にトリガー
        // - タイムフリー：終了時刻にトリガー（開始時刻 + 録音時間 + バッファ）

        const targets: Schedule[] = [];

        // ワンタイム予約の処理
        for (const s of pendingSchedules) {
            const schedule = s as Schedule;
            if (shouldTrigger(schedule, jstNow)) {
                targets.push(schedule);
            }
        }

        // 毎週予約の処理
        for (const s of weeklySchedules) {
            const schedule = s as Schedule;
            if (shouldTriggerWeekly(schedule, jstNow)) {
                targets.push(schedule);
            }
        }

        for (const s of targets) {
            logger.info({ title: s.title, stationId: s.station_id }, 'Triggering schedule');

            // ワンタイムの場合はステータス更新
            if (!s.recurring_pattern) {
                drizzleDb.update(schedulesTable).set({ status: 'processing' }).where(eq(schedulesTable.id, s.id)).run();
            }

            // 録音実行
            // 毎週予約なら、スケジュールの設定内容から正確な開始日時を算出する
            let recStartTime = s.start_time;
            if (s.recurring_pattern === 'weekly') {
                const [h, m] = s.start_time.split(':').map(Number);
                // 一旦「今日」の日付でオブジェクトを作成 (h >= 24 の場合、自動的に翌日に繰り越される)
                const programDate = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate(), h, m);

                // もしスケジュールの日付が「今日」でない（＝昨日 >24h の番組が今日トリガーされた）場合、1日戻す
                if (s.day_of_week !== currentDayOfWeek) {
                    programDate.setDate(programDate.getDate() - 1);
                }
                recStartTime = programDate.toISOString();
            }

            const isRealtime = s.is_realtime === 1;

            recordRadiko(s.station_id, s.duration, s.title ?? undefined, s.id, recStartTime, isRealtime)
                .then((res: { success?: boolean; filename?: string; size?: number; error?: string }) => {
                    logger.info(`Schedule completed: ${s.id}`);
                    if (!s.recurring_pattern) {
                        drizzleDb.update(schedulesTable).set({ status: 'completed', retry_count: 0 }).where(eq(schedulesTable.id, s.id)).run();
                    }

                    // Discord通知を送信
                    sendDiscordNotification(`✅ 録音完了: ${s.title || s.station_id}`, {
                        title: s.title || '無題の番組',
                        color: 0x00ff00, // 緑色
                        fields: [
                            { name: '放送局', value: s.station_id, inline: true },
                            { name: 'サイズ', value: formatFileSize(res.size || 0), inline: true },
                            { name: '録音時間', value: `${s.duration}分`, inline: true }
                        ],
                        timestamp: new Date().toISOString()
                    });
                })
                .catch(err => {
                    logger.error({ error: err }, 'Recording error:');
                    const errorMsg = err instanceof Error ? err.message : String(err);

                    if (!s.recurring_pattern) {
                        const newRetryCount = (s.retry_count || 0) + 1;
                        if (newRetryCount <= 3) {
                            logger.info(`Rescheduling ${s.id} for retry ${newRetryCount}...`);
                            drizzleDb.update(schedulesTable).set({
                                status: 'pending',
                                retry_count: newRetryCount,
                                error_message: `Retry ${newRetryCount}: ${errorMsg}`
                            }).where(eq(schedulesTable.id, s.id)).run();
                        } else {
                            drizzleDb.update(schedulesTable).set({
                                status: 'failed',
                                error_message: errorMsg
                            }).where(eq(schedulesTable.id, s.id)).run();
                        }
                    } else {
                        // 現在、毎週予約（weekly）は複雑さを避けるため、再スケジュールに retry_count を使用していません
                        // エラーをログに記録するのみです
                        // ただし、エラーメッセージの更新は行います
                        drizzleDb.update(schedulesTable).set({
                            error_message: `Last attempt failed: ${errorMsg}`
                        }).where(eq(schedulesTable.id, s.id)).run();
                    }

                    // Discord通知を送信 (リトライ中は送信しないか、リトライ中であることを明示する)
                    const isRetrying = !s.recurring_pattern && ((s.retry_count || 0) + 1 <= 3);
                    const statusText = isRetrying ? `⚠️ 録音再試行中 (${(s.retry_count || 0) + 1}/3)` : `❌ 録音失敗`;

                    sendDiscordNotification(`${statusText}: ${s.title || s.station_id}`, {
                        title: s.title || '無題の番組',
                        color: isRetrying ? 0xffa500 : 0xff0000, // オレンジ色または赤色
                        description: `エラー内容: \`\`\`${errorMsg}\`\`\``,
                        fields: [
                            { name: '放送局', value: s.station_id, inline: true },
                            { name: '録音時間', value: `${s.duration}分`, inline: true }
                        ],
                        timestamp: new Date().toISOString()
                    });
                });

        }
    });
}

export function shouldTrigger(s: Schedule, now: Date): boolean {
    const isRealtime = s.is_realtime === 1;

    // ワンタイムは start_time = YYYY-MM-DDTHH:mm
    if (isRealtime) {
        // リアルタイム: 開始時刻以前なら実行 (start_time <= now)
        // クエリで既に <= ? としているので、ここではPendingならOK
        // ただし、余りにも過去すぎる(1時間前とか)は無視するか？一旦OKとする
        return true;
    } else {
        // リトライ中の場合は、時間の経過に関わらず即座に実行を許可する
        if (s.retry_count && s.retry_count > 0) {
            return true;
        }

        // タイムフリー: 終了時刻 + 5分後くらいに実行
        // start_time から duration を足して終了時刻を計算
        const start = new Date(s.start_time);
        // バッファ 5分 (radiko側の生成待ち時間を考慮して長めに)
        const triggerTime = addMinutes(start, s.duration + 5);

        // 差分が 0〜1分以内なら実行
        const diff = differenceInMinutes(now, triggerTime);
        return diff >= 0 && diff < 2; // 0または1分以内なら実行
    }
}

export function shouldTriggerWeekly(s: Schedule, now: Date): boolean {
    const isRealtime = s.is_realtime === 1;
    let timePart = s.start_time;
    if (s.start_time.includes('T')) {
        timePart = s.start_time.split('T')[1];
    }
    const [startH, startM] = timePart.split(':').map(Number); // 例: "25:30" -> 25, 30

    // 過去2日から今日までの論理的な放送日をチェック (24時間を超える深夜放送をカバーするため)
    for (let dayOffset = -2; dayOffset <= 0; dayOffset++) {
        // offsetDayの深夜0時を基準とする
        const offsetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);

        // s.day_of_week と offsetDate の曜日が一致するか確認
        if (getDay(offsetDate) === s.day_of_week) {
            // 一致した場合、この日の論理的な開始時刻を作成
            const actualStartDate = new Date(offsetDate.getFullYear(), offsetDate.getMonth(), offsetDate.getDate(), startH, startM);

            if (isRealtime) {
                // リアルタイム: ちょうどその開始時刻になったら実行
                if (getHours(actualStartDate) === getHours(now) && getMinutes(actualStartDate) === getMinutes(now) && getDay(actualStartDate) === getDay(now)) {
                    return true;
                }
            } else {
                // タイムフリー: (開始 + 時間 + 5分) と一致したら実行
                const triggerDate = addMinutes(actualStartDate, s.duration + 5);
                if (getHours(triggerDate) === getHours(now) && getMinutes(triggerDate) === getMinutes(now) && getDay(triggerDate) === getDay(now)) {
                    return true;
                }
            }
        }
    }

    return false;
}
