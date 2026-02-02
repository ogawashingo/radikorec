import { db } from '@/lib/db';
import { RadikoClient } from '@/lib/radiko';
import { sendDiscordNotification } from '@/lib/notifier';

const radiko = new RadikoClient();

import fs from 'fs';
import path from 'path';

const logFile = path.join(process.cwd(), 'scanner.log');

function log(msg: string) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
}

export async function scanAndReserve() {
    log('Starting keyword scan...');

    // 1. 有効なキーワードを取得
    const keywords = db.prepare('SELECT * FROM keywords WHERE enabled = 1').all() as { id: number, keyword: string }[];

    if (keywords.length === 0) {
        log('No enabled keywords found.');
        return;
    }

    let reservedCount = 0;

    for (const k of keywords) {
        try {
            log(`Searching for keyword: ${k.keyword}`);

            // レート制限: 1-3秒待機
            const delay = 1000 + Math.random() * 2000;
            await new Promise(r => setTimeout(r, delay));

            const programs = await radiko.search(k.keyword);
            log(`Found ${programs.length} programs from API.`);

            // フィルタ: 未来の番組のみ
            const now = new Date();
            const futurePrograms = programs.filter(p => new Date(p.start_time) > now);
            log(`Future programs: ${futurePrograms.length}`);

            for (const prog of futurePrograms) {
                log(`Processing: ${prog.title} at ${prog.start_time}`);
                // 重複チェック
                // フォーマット変換: "2026-02-02 12:00:00" -> "2026-02-02T12:00"
                // DBは通常ISO形式で保存。比較のためISO形式に統一する
                // APIは "YYYY-MM-DD HH:mm:ss" を送信
                // 手動予約は "YYYY-MM-DDTHH:mm" を使用
                // API時刻をISO形式 "YYYY-MM-DDTHH:mm:ss" に変換

                const startTimeDate = new Date(prog.start_time);
                // シンプルな重複チェック: station_id + start_time (概算)
                // 手動入力の差異を許容する柔軟な範囲チェックを使用
                // DBクエリに依存

                // SQLiteはデフォルトで良い日付関数を持たないため、JSで処理
                // この放送局でこの時間前後(±2分)に予約が存在するかチェック
                const existing = db.prepare("SELECT id FROM schedules WHERE station_id = ? AND date(start_time) = date(?) AND abs(strftime('%s', start_time) - strftime('%s', ?)) < 120").get(
                    prog.station_id,
                    prog.start_time,
                    prog.start_time
                );

                if (!existing) {
                    console.log(`Reserving: ${prog.title} (${prog.start_time})`);

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
                }
            }

        } catch (e) {
            log(`Error processing keyword ${k.keyword}: ${e}`);
            console.error(`Error processing keyword ${k.keyword}:`, e);
        }
    }

    console.log(`Scan complete. Reserved ${reservedCount} programs.`);

    if (reservedCount > 0) {
        await sendDiscordNotification(`[キーワード自動予約] ${reservedCount} 件の番組を予約しました。`);
    }
}
