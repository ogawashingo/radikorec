import cron from 'node-cron';
import { db } from '@/lib/db';
import { recordRadiko } from '@/lib/recorder';
import { sendDiscordNotification, formatFileSize } from '@/lib/notifier';

// 開発中の重複初期化を防ぐためのグローバル参照
let isSchedulerRunning = false;

interface Schedule {
    id: number;
    station_id: string;
    // format YYYY-MM-DDTHH:mm OR HH:mm (for weekly)
    start_time: string;
    duration: number;
    title?: string;
    recurring_pattern?: string;
    day_of_week?: number; // 0-6
    status: string;
}

export function initScheduler() {
    if (isSchedulerRunning) {
        console.log('Scheduler already running.');
        return;
    }

    console.log('Starting Scheduler...');
    isSchedulerRunning = true;

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
        // start_time は 'HH:mm' 形式で保存されている前提
        // status は管理しない (常に実行対象。ただし、多重起動防止は必要だが、cronが1分刻み＆この処理が1分以内に終わればOK)
        // 厳密には「前回の実行日時」を記録すべきだが、簡易的に「現在のHH:mmと一致」で判定
        const weeklySchedules = db.prepare(`
            SELECT * FROM schedules 
            WHERE recurring_pattern = 'weekly'
              AND day_of_week = ?
              AND start_time = ?
        `).all(currentDayOfWeek, currentTimeStr) as Schedule[];

        // 両方を結合して実行
        const targets = [...schedules, ...weeklySchedules];

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

            recordRadiko(s.station_id, s.duration, s.title, s.id, recStartTime)
                .then((res: any) => {
                    console.log(`Schedule completed: ${s.id}`);
                    if (!s.recurring_pattern) {
                        db.prepare("UPDATE schedules SET status = 'completed' WHERE id = ?").run(s.id);
                    }

                    // Send Discord notification
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

                    // Send Discord notification
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
