import { spawn } from 'child_process';
import path from 'path';
import { db } from '@/lib/db';
import fs from 'fs';

const REC_SCRIPT = path.join(process.cwd(), 'rec_radiko_ts.sh');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'records');

// 出力ディレクトリが存在することを確認
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export async function recordRadiko(stationId: string, durationMin: number, title?: string, scheduleId?: number, startTime?: string) {
    return new Promise((resolve, reject) => {
        // ファイル名を決定
        const now = new Date();
        // format YYYYMMDDHHMMSS
        const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0];

        let safeTitle = stationId;
        if (title) {
            // 安全でない文字を削除、スペースをアンダースコアに変換
            safeTitle = title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
        }

        const filename = `${safeTitle}_${timestamp}.m4a`;
        const outputPath = path.join(OUTPUT_DIR, filename);

        // 録音時間 (-d) を指定
        const args = ['-s', stationId, '-d', String(durationMin), '-o', outputPath];

        // 開始日時 (startTime) が指定されている場合は -f オプションを追加 (タイムフリー録音用)
        if (startTime) {
            const fValue = startTime.replace(/[-:T]/g, '').slice(0, 12); // YYYYMMDDHHMM
            args.push('-f', fValue);
        } else {
            // 現在時刻を指定 (一応)
            const nowValue = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
            args.push('-f', nowValue);
        }

        // 環境変数が存在する場合は認証情報を追加
        if (process.env.RADIKO_MAIL) args.push('-m', process.env.RADIKO_MAIL);
        if (process.env.RADIKO_PASSWORD) args.push('-p', process.env.RADIKO_PASSWORD);

        console.log(`[REC ${stationId}] Executing: ${REC_SCRIPT} ${args.join(' ')}`);

        const child = spawn(REC_SCRIPT, args);
        let errorOutput = '';

        child.stdout.on('data', (data) => {
            console.log(`[REC ${stationId} STDOUT] ${data}`);
        });

        child.stderr.on('data', (data) => {
            const str = data.toString();
            console.error(`[REC ${stationId} STDERR] ${str}`);
            errorOutput += str;
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`Recording finished: ${filename}`);

                // ファイルサイズを取得
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
                    console.error('Failed to save record to DB:', dbError);
                    resolve({ success: true, filename, error: 'DB Insert Failed' });
                }
            } else {
                console.error(`Recording failed with code ${code}`);
                // 最後の数行程度をエラーメッセージとして採用
                const summary = errorOutput.split('\n').filter(l => l.trim()).slice(-3).join('\n') || `Exit code ${code}`;
                reject(new Error(summary));
            }
        });
    });
}

