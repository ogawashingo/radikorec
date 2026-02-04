import { db } from '@/lib/db';
import { RadikoRecorder } from '@/lib/recorder-core';
import path from 'path';
import fs from 'fs';

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'records');

// 出力ディレクトリが存在することを確認
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export async function recordRadiko(stationId: string, durationMin: number, title?: string, scheduleId?: number, startTime?: string, isRealtime: boolean = false) {
    return new Promise(async (resolve, reject) => {
        // ファイル名を決定
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0];

        let safeTitle = stationId;
        if (title) {
            safeTitle = title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
        }

        // 拡張子は RadikoRecorder が m4a で保存する (ffmpeg -acodec copy)
        const filename = `${safeTitle}_${timestamp}.m4a`;
        const outputPath = path.join(OUTPUT_DIR, filename);

        const recorder = new RadikoRecorder();

        // startTime 文字列を Date 型へ変換
        let startTimeDate: Date;
        if (startTime) {
            startTimeDate = new Date(startTime);
            if (isNaN(startTimeDate.getTime())) {
                console.warn(`無効な開始時刻: ${startTime}, 現在時刻を使用します。`);
                startTimeDate = now;
            }
        } else {
            startTimeDate = now;
        }

        try {
            await recorder.record(stationId, startTimeDate, durationMin, outputPath, isRealtime);

            // 録音完了後の処理 (DB保存など)
            console.log(`録音完了: ${filename}`);

            if (!fs.existsSync(outputPath)) {
                throw new Error('録音後に出力ファイルが見つかりません');
            }

            const stats = fs.statSync(outputPath);
            const size = stats.size;

            // records DBに挿入
            try {
                const stmt = db.prepare(`
        INSERT INTO records (filename, station_id, title, start_time, duration, file_path, size)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
                stmt.run(filename, stationId, title || null, now.toISOString(), durationMin, `/records/${filename}`, size);

                resolve({ success: true, filename, size });

            } catch (dbError) {
                console.error('DBへの保存に失敗しました:', dbError);
                resolve({ success: true, filename, error: 'DB Insert Failed' });
            }

        } catch (error: any) {
            console.error(`録音に失敗しました: ${error.message}`);
            reject(error);
        }
    });
}
