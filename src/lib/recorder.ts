import { drizzleDb } from '@/lib/db';
import { records } from '@/lib/schema';
import { RadikoRecorder } from '@/lib/recorder-core';
import { logger } from '@/lib/logger';
import path from 'path';
import fs from 'fs';

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'records');

// 出力ディレクトリが存在することを確認
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export async function recordRadiko(stationId: string, durationMin: number, title?: string, scheduleId?: number, startTime?: string, isRealtime: boolean = false, onProgress?: (percent: number) => void) {
    const now = new Date();
    // startTime 文字列を Date 型へ変換
    let startTimeDate: Date;
    if (startTime) {
        startTimeDate = new Date(startTime);
        if (isNaN(startTimeDate.getTime())) {
            logger.warn({ startTime }, 'Invalid start time, using current time');
            startTimeDate = now;
        }
    } else {
        startTimeDate = now;
    }

    // ファイル名を決定 (startTimeDate を使用)
    const Y = startTimeDate.getFullYear();
    const M = String(startTimeDate.getMonth() + 1).padStart(2, '0');
    const D = String(startTimeDate.getDate()).padStart(2, '0');
    const h = String(startTimeDate.getHours()).padStart(2, '0');
    const m = String(startTimeDate.getMinutes()).padStart(2, '0');
    const s = String(startTimeDate.getSeconds()).padStart(2, '0');
    const timestamp = `${Y}${M}${D}${h}${m}${s}`;

    let safeTitle = stationId;
    if (title) {
        safeTitle = title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
    }

    // 拡張子は RadikoRecorder が m4a で保存する (ffmpeg -acodec copy)
    const filename = `${safeTitle}_${timestamp}.m4a`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    const recorder = new RadikoRecorder();

    try {
        await recorder.record(stationId, startTimeDate, durationMin, outputPath, isRealtime, onProgress);

        // 録音完了後の処理 (DB保存など)
        logger.info({ filename }, 'Recording completed');

        if (!fs.existsSync(outputPath)) {
            throw new Error('録音後に出力ファイルが見つかりません');
        }

        const stats = fs.statSync(outputPath);
        const size = stats.size;


        // records DBに挿入
        try {
            drizzleDb.insert(records).values({
                filename,
                station_id: stationId,
                title: title || null,
                start_time: startTimeDate.toISOString(),
                duration: durationMin,
                file_path: `/records/${filename}`,
                size,
                is_watched: 0
            }).run();

            return { success: true, filename, size };

        } catch (dbError) {
            logger.error('DBへの保存に失敗しました:', dbError);
            return { success: true, filename, error: 'DB Insert Failed' };
        }

    } catch (error: any) {
        logger.error(`録音に失敗しました: ${error.message}`);
        throw error;
    }
}
