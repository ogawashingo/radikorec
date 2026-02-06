import cron from 'node-cron';
import { db } from '@/lib/db';
import { recordRadiko } from '@/lib/recorder';
import { sendDiscordNotification, formatFileSize } from '@/lib/notifier';
import { scanAndReserve } from '@/lib/scanner';

// 開発中の重複初期化を防ぐためのグローバル参照
let isSchedulerRunning = false;

interface Schedule {
    id: number;
    station_id: string;
    // フォーマット YYYY-MM-DDTHH:mm または HH:mm (毎週の場合)
    start_time: string;
    duration: number;
    title?: string;
    recurring_pattern?: string;
    day_of_week?: number; // 0-6
    status: string;
    is_realtime?: number;
}

export function initScheduler() {
    if (isSchedulerRunning) {
        console.log('Scheduler already running.');
        return;
    }

    console.log('Starting Scheduler...');
    isSchedulerRunning = true;

    // 毎日のキーワードスキャン (04:00 JST)
    cron.schedule('0 4 * * *', async () => {
        console.log('Running daily keyword scan...');
        try {
            await scanAndReserve();
        } catch (e) {
            console.error('Keyword scan failed:', e);
        }
    }, {
        timezone: "Asia/Tokyo"
    });

    // 1分ごとに実行
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const JST_OFFSET = 9 * 60; // JST は UTC+9
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const jstNow = new Date(utc + (JST_OFFSET * 60000));

        // JSTでの現在時刻文字列 (YYYY-MM-DDTHH:mm)
        // ISOStringはUTCを返すため、手動構築またはオフセット調整済みDateを使用
        // ここでは単純に文字列操作でフォーマット
        const yyyy = jstNow.getFullYear();
        const mm = String(jstNow.getMonth() + 1).padStart(2, '0');
        const dd = String(jstNow.getDate()).padStart(2, '0');
        const hh = String(jstNow.getHours()).padStart(2, '0');
        const min = String(jstNow.getMinutes()).padStart(2, '0');

        const localNowStr = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        const currentTimeStr = `${hh}:${min}`; // HH:mm for weekly check
        const currentDayOfWeek = jstNow.getDay(); // 0(Sun) - 6(Sat)

        console.log(`Scheduler tick (JST): ${localNowStr} (Day: ${currentDayOfWeek})`);

        // 1. ワンタイム予約 (pending かつ 過去)
        const schedules = db.prepare(`
            SELECT * FROM schedules 
            WHERE status = 'pending' 
              AND recurring_pattern IS NULL 
              AND start_time <= ?
        `).all(localNowStr) as Schedule[];

        // 2. 毎週予約 (weekly)
        const weeklySchedules = db.prepare(`
            SELECT * FROM schedules 
            WHERE recurring_pattern = 'weekly'
              AND day_of_week = ?
        `).all(currentDayOfWeek) as Schedule[];

        // 両方を結合してチェック
        // One-time schedules (pending) and All Weekly schedules for today
        // We filter them based on:
        // - Realtime: Trigger at Start Time
        // - TimeFree: Trigger at End Time (Start + Duration + Buffer)

        const targets: Schedule[] = [];

        // One-time processing
        for (const s of schedules) {
            if (shouldTrigger(s, yyyy, mm, dd, hh, min)) {
                targets.push(s);
            }
        }

        // Weekly processing
        for (const s of weeklySchedules) {
            // Weekly schedules have "HH:mm" in start_time
            // Construct a "Today" version of the schedule
            if (shouldTriggerWeekly(s, hh, min)) {
                targets.push(s);
            }
        }

        for (const s of targets) {
            console.log(`Triggering schedule: ${s.title} (${s.station_id})`);

            // ワンタイムの場合はステータス更新
            if (!s.recurring_pattern) {
                db.prepare("UPDATE schedules SET status = 'processing' WHERE id = ?").run(s.id);
            }

            // 録音実行
            // タイムフリー録音用引数計算:
            // ワンタイムなら s.start_time そのもの (YYYY-MM-DDTHH:mm)
            // 毎週予約なら、今日の現在時刻 (YYYY-MM-DDTHH:mm) または 指定時刻
            // ※ 毎週予約は「現在放送中」を録音するケースと「タイムフリー」のケースがありうるが、
            //    このSchedulerはリアルタイムまたは過去即時実行用。
            //    毎週予約で「HH:mm」指定の場合、それは「今日のHH:mm」を意味する。
            let recStartTime = s.start_time;
            if (s.recurring_pattern === 'weekly') {
                recStartTime = `${yyyy}-${mm}-${dd}T${s.start_time}`;
            }

            const isRealtime = s.is_realtime === 1;

            recordRadiko(s.station_id, s.duration, s.title, s.id, recStartTime, isRealtime)
                .then((res: any) => {
                    console.log(`Schedule completed: ${s.id}`);
                    if (!s.recurring_pattern) {
                        db.prepare("UPDATE schedules SET status = 'completed' WHERE id = ?").run(s.id);
                    }

                    // Discord通知を送信
                    sendDiscordNotification(`✅ 録音完了: ${s.title || s.station_id}`, {
                        title: s.title || '無題の番組',
                        color: 0x00ff00, // Green
                        fields: [
                            { name: '放送局', value: s.station_id, inline: true },
                            { name: 'サイズ', value: formatFileSize(res.size || 0), inline: true },
                            { name: '録音時間', value: `${s.duration}分`, inline: true }
                        ],
                        timestamp: new Date().toISOString()
                    });
                })
                .catch(err => {
                    console.error('Recording error:', err);
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    if (!s.recurring_pattern) {
                        db.prepare("UPDATE schedules SET status = 'failed', error_message = ? WHERE id = ?")
                            .run(errorMsg, s.id);
                    }

                    // Discord通知を送信
                    sendDiscordNotification(`❌ 録音失敗: ${s.title || s.station_id}`, {
                        title: s.title || '無題の番組',
                        color: 0xff0000, // Red
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

function shouldTrigger(s: Schedule, yyyy: number, mm: string, dd: string, hh: string, min: string): boolean {
    const isRealtime = s.is_realtime === 1;
    const nowStr = `${yyyy}-${mm}-${dd}T${hh}:${min}`;

    // ワンタイムは start_time = YYYY-MM-DDTHH:mm
    if (isRealtime) {
        // リアルタイム: 開始時刻以前なら実行 (start_time <= now)
        // クエリで既に <= ? としているので、ここではPendingならOK
        // ただし、余りにも過去すぎる(1時間前とか)は無視するか？一旦OKとする
        return true;
    } else {
        // タイムフリー: 終了時刻 + 2分後くらいに実行
        // start_time から duration を足して終了時刻を計算
        const start = new Date(s.start_time);
        const end = new Date(start.getTime() + s.duration * 60000);
        // バッファ 2分
        const triggerTime = new Date(end.getTime() + 2 * 60000);

        // トリガー時刻を "HH:mm" で比較するのは難しいので、分単位の差分で見る
        // 現在時刻とトリガー時刻が「同じ分」であれば実行
        const current = new Date(nowStr);

        // 差分が 0〜1分以内なら実行
        const diff = (current.getTime() - triggerTime.getTime()) / 60000;
        return diff >= 0 && diff < 2; // 2分間のウィンドウ
    }
}

function shouldTriggerWeekly(s: Schedule, currentHH: string, currentMin: string): boolean {
    const isRealtime = s.is_realtime === 1;
    const [startH, startM] = s.start_time.split(':').map(Number);

    if (isRealtime) {
        // リアルタイム: 開始時刻と一致したら実行
        return startH === Number(currentHH) && startM === Number(currentMin);
    } else {
        // タイムフリー: (開始 + 時間 + 2分) と一致したら実行
        const startTotalMin = startH * 60 + startM;
        const endTotalMin = startTotalMin + s.duration;
        const triggerTotalMin = endTotalMin + 2; // 2分バッファ

        // 日をまたぐ場合の処理 (24 * 60 = 1440)
        let targetTotalMin = triggerTotalMin % 1440;

        const currentTotalMin = Number(currentHH) * 60 + Number(currentMin);

        return targetTotalMin === currentTotalMin;
    }
}
