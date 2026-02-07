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
        // Docker container is now set to JST (TZ=Asia/Tokyo)
        // So new Date() returns correct local time. No manual offset needed.
        const jstNow = new Date();

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
        const prevDayOfWeek = (currentDayOfWeek - 1 + 7) % 7;
        const weeklySchedules = db.prepare(`
            SELECT * FROM schedules 
            WHERE recurring_pattern = 'weekly'
              AND day_of_week IN (?, ?)
        `).all(currentDayOfWeek, prevDayOfWeek) as Schedule[];

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
            if (shouldTriggerWeekly(s, hh, min, currentDayOfWeek)) {
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
            // 毎週予約なら、現在トリガーされた時刻 (localNowStr) を使用
            // これにより "25:30" などの深夜表記も、実際の "翌日01:30" (YYYY-MM-DDTHH:mm) として渡される
            let recStartTime = s.start_time;
            if (s.recurring_pattern === 'weekly') {
                recStartTime = localNowStr;
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
        // タイムフリー: 終了時刻 + 5分後くらいに実行
        // start_time から duration を足して終了時刻を計算
        const start = new Date(s.start_time);
        const end = new Date(start.getTime() + s.duration * 60000);
        // バッファ 5分 (Radiko側の生成待ち時間を考慮して長めに)
        const triggerTime = new Date(end.getTime() + 5 * 60000);

        // トリガー時刻を "HH:mm" で比較するのは難しいので、分単位の差分で見る
        // 現在時刻とトリガー時刻が「同じ分」であれば実行
        const current = new Date(nowStr);

        // 差分が 0〜1分以内なら実行
        const diff = (current.getTime() - triggerTime.getTime()) / 60000;
        return diff >= 0 && diff < 2; // 実行ウィンドウは同様
    }
}

function shouldTriggerWeekly(s: Schedule, currentHH: string, currentMin: string, currentDayOfWeek: number): boolean {
    const isRealtime = s.is_realtime === 1;
    let timePart = s.start_time;
    if (s.start_time.includes('T')) {
        timePart = s.start_time.split('T')[1];
    }
    const [startH, startM] = timePart.split(':').map(Number); // e.g. "25:30" -> 25, 30

    let targetH = startH;
    let targetM = startM;

    // Determine effective target hour for TODAY
    if (s.day_of_week !== currentDayOfWeek) {
        // This is a schedule from a different day (Yesterday)
        // It triggers today ONLY if it is a Late Night schedule (>24h)
        if (startH >= 24) {
            targetH = startH - 24;
        } else {
            return false;
        }
    } else {
        // This is a schedule for Today.
        // If startH >= 24, it runs Tomorrow (so ignore Today)
        if (startH >= 24) {
            return false;
        }
    }

    if (isRealtime) {
        // リアルタイム: 開始時刻と一致したら実行
        return targetH === Number(currentHH) && targetM === Number(currentMin);
    } else {
        // タイムフリー: (開始 + 時間 + 5分) と一致したら実行
        const startTotalMin = targetH * 60 + targetM;
        const endTotalMin = startTotalMin + s.duration;
        const triggerTotalMin = endTotalMin + 5; // 5分バッファ

        // 日をまたぐ場合の処理 (24 * 60 = 1440)
        let targetTotalMin = triggerTotalMin % 1440;

        const currentTotalMin = Number(currentHH) * 60 + Number(currentMin);

        return targetTotalMin === currentTotalMin;
    }
}
