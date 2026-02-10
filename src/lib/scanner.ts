import { db } from '@/lib/db';
import { RadikoClient } from '@/lib/radiko';
import { sendDiscordNotification } from '@/lib/notifier';
import { logger } from '@/lib/logger';

const radiko = new RadikoClient();

/**
 * 番組タイトルの正規化（現在は前後空白の削除のみ）
 */
function normalizeTitle(title: string): string {
    return title.trim();
}

export async function scanAndReserve() {
    logger.info('Starting keyword scan...');

    // 1. 有効なキーワードを取得
    const keywords = db.prepare('SELECT * FROM keywords WHERE enabled = 1').all() as { id: number, keyword: string, prevent_duplicates: number }[];

    if (keywords.length === 0) {
        logger.info('No enabled keywords found.');
        return;
    }

    let reservedCount = 0;
    // 同一スキャンセッション内での重複予約を防止するためのセット
    const sessionReserved = new Set<string>();

    for (const k of keywords) {
        try {
            logger.debug({ keyword: k.keyword }, 'Searching for keyword');

            // レート制限: 1-3秒待機
            const delay = 1000 + Math.random() * 2000;
            await new Promise(r => setTimeout(r, delay));

            const programs = await radiko.search(k.keyword);
            logger.info({ keyword: k.keyword, count: programs.length }, 'Found programs from API');

            // フィルタ: 未来の番組（または現在放送中）のみ
            const now = new Date();
            const futurePrograms = programs.filter(p => new Date(p.end_time) > now);
            logger.info({ count: futurePrograms.length }, 'Future/Current programs');

            for (const prog of futurePrograms) {
                logger.debug({ title: prog.title, startTime: prog.start_time }, 'Processing program');

                const normalizedTitle = normalizeTitle(prog.title);
                const startTimeStr = prog.start_time.replace(' ', 'T');
                // セッション内重複チェック用のキー (タイトル + 開始時刻)
                const sessionKey = `${normalizedTitle}_${startTimeStr}`;

                if (k.prevent_duplicates) {
                    if (sessionReserved.has(sessionKey)) {
                        logger.debug({ title: prog.title }, 'Skipping: already reserved in this session');
                        continue;
                    }

                    // 重複チェック
                    // 放送局を問わず、タイトル（正規化後）と開始時刻が近い予約が既に存在するか確認
                    // SQLite上での正規化は難しいため、まず時間帯が近いものをすべて取得してJS側で判定する
                    // 誤差5分 (300秒) 以内の予約を取得
                    const candidates = db.prepare(`
                        SELECT title, start_time 
                        FROM schedules 
                        WHERE abs(strftime('%s', start_time) - strftime('%s', ?)) < 300
                    `).all(prog.start_time.replace(' ', 'T')) as { title: string, start_time: string }[];

                    const isDuplicate = candidates.some(c => normalizeTitle(c.title || '') === normalizedTitle);

                    if (isDuplicate) {
                        logger.debug({ title: prog.title, stationId: prog.station_id }, 'Skipping duplicate found in DB');
                        continue;
                    }
                }
                logger.info({ title: prog.title, startTime: prog.start_time }, 'Reserving program');

                // 表示時間の計算
                // prog.start_time は "2026-02-02 18:50:00" 形式
                // 録音時間が必要。API結果にはend_timeがある
                const start = new Date(prog.start_time);
                const end = new Date(prog.end_time);
                const duration = Math.round((end.getTime() - start.getTime()) / 60000); // minutes

                // 挿入
                db.prepare(`
                        INSERT INTO schedules (station_id, start_time, duration, title, status)
                        VALUES (?, ?, ?, ?, 'pending')
                    `).run(
                    prog.station_id,
                    prog.start_time.replace(' ', 'T'), // Normalize to ISO-ish
                    duration,
                    prog.title
                );

                reservedCount++;
                sessionReserved.add(sessionKey);
            }
        } catch (e) {
            logger.error({ keyword: k.keyword, error: e }, 'Error processing keyword');
        }
    }

    logger.info({ reservedCount }, 'Scan complete');

    if (reservedCount > 0) {
        await sendDiscordNotification(`[キーワード自動予約] ${reservedCount} 件の番組を予約しました。`);
    }
}
