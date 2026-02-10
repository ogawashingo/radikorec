import { spawn } from 'child_process';
import crypto from 'crypto';
import { RadikoClient } from './radiko';
import { logger } from './logger';
import path from 'path';
import fs from 'fs';
import os from 'os';

export class RadikoRecorder {
    private client: RadikoClient;

    constructor() {
        this.client = new RadikoClient();
    }

    private formatRadikoDate(date: Date): string {
        const Y = date.getFullYear();
        const M = String(date.getMonth() + 1).padStart(2, '0');
        const D = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${Y}${M}${D}${h}${m}${s}`;
    }

    private getLsid(): string {
        // 疑似ランダムなMD5ハッシュ値（16進数32文字）を生成
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * ffmpegを使用して番組を録音する
     */
    async record(stationId: string, startTime: Date, durationMin: number, outputPath: string, isRealtime: boolean = false): Promise<void> {
        logger.info({ stationId, isRealtime }, 'Starting recording');

        // 1. 認証 (エリアIDと認証トークンの取得)
        const auth = await this.client.getAuthToken();
        const durationSec = durationMin * 60;

        if (isRealtime) {
            // --- リアルタイム録音 ---
            const liveStreamUrl = await this.client.getLiveStreamBaseUrl(stationId);
            const lsid = this.getLsid();

            const url = new URL(liveStreamUrl);
            url.searchParams.set('station_id', stationId);
            url.searchParams.set('l', '15');
            url.searchParams.set('lsid', lsid); // セッション維持のため lsid を復活 (ランダム生成)
            url.searchParams.set('type', 'c'); // type=c は維持

            const fullUrl = url.toString();
            // ライブ録画でもエリア認証が必要な場合があるため ID を追加
            const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            const headers = `X-Radiko-Authtoken: ${auth.authtoken}\r\nX-Radiko-AreaId: ${auth.area_id}\r\n`;

            const ffmpegArgs = [
                '-nostdin',
                '-loglevel', 'warning', // エラー原因特定のため詳細化
                '-fflags', '+discardcorrupt',
                '-headers', headers,
                '-user_agent', userAgent,
                '-http_seekable', '0',
                '-rw_timeout', '30000000', // 30秒タイムアウト (マイクロ秒)
                '-multiple_requests', '1', // HTTP keep-alive
                '-reconnect', '1',
                '-reconnect_at_eof', '1', // ストリーム終了扱いになった場合の再接続
                '-reconnect_streamed', '1',
                '-reconnect_delay_max', '5',
                '-seekable', '0',
                '-i', fullUrl,
                '-t', String(durationSec),
                '-acodec', 'copy',
                '-vn',
                '-bsf:a', 'aac_adtstoasc',
                '-y',
                outputPath
            ];

            await this.spawnFfmpeg(ffmpegArgs, 'ライブ録音');

        } else {
            // --- タイムフリー録音 (チャンク分割実装) ---
            const streamBaseUrl = await this.client.getStreamBaseUrl(stationId);

            // 一時ファイルは OS の一時ディレクトリ (/tmp など) に作成する
            // これにより、権限エラー(EACCES)を回避し、recordsディレクトリを汚さない
            const tmpDir = os.tmpdir();
            const tmpFileBase = `chunk_${crypto.randomBytes(4).toString('hex')}`;
            const fileListPath = path.join(tmpDir, `${tmpFileBase}_filelist.txt`);

            const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            const headers = `X-Radiko-Authtoken: ${auth.authtoken}\r\nX-Radiko-AreaId: ${auth.area_id}\r\n`;
            const lsid = this.getLsid();

            const ftStr = this.formatRadikoDate(startTime);
            // const toStr = this.formatRadikoDate(new Date(startTime.getTime() + durationSec * 1000));

            let leftSec = durationSec;
            let currentSeekTime = startTime.getTime();
            let chunkNo = 0;
            const chunkFiles: string[] = [];

            // filelist.txt 作成
            fs.writeFileSync(fileListPath, '');

            try {
                logger.info({ stationId, durationSec }, 'Starting timefree chunk download');

                while (leftSec > 0) {
                    const chunkFile = path.join(tmpDir, `${tmpFileBase}_${chunkNo}.m4a`);

                    // チャンク長計算 (基本300秒)
                    let l = 300;
                    if (leftSec < 300) {
                        if ((leftSec % 5) === 0) {
                            l = leftSec;
                        } else {
                            l = (Math.floor(leftSec / 5) + 1) * 5;
                        }
                    }

                    const seekDate = new Date(currentSeekTime);
                    const endDate = new Date(currentSeekTime + l * 1000);

                    const currentSeekStr = this.formatRadikoDate(seekDate);
                    const currentEndStr = this.formatRadikoDate(endDate);

                    // URL構築
                    const url = new URL(streamBaseUrl);
                    url.searchParams.set('station_id', stationId);
                    url.searchParams.set('start_at', ftStr); // 全体の開始時刻
                    url.searchParams.set('ft', ftStr);       // 全体の開始時刻
                    url.searchParams.set('seek', currentSeekStr); // チャンク開始時刻
                    url.searchParams.set('end_at', currentEndStr); // チャンク終了時刻
                    url.searchParams.set('to', currentEndStr);     // チャンク終了時刻
                    url.searchParams.set('l', String(l));
                    url.searchParams.set('lsid', lsid);
                    url.searchParams.set('type', 'c');

                    const fullUrl = url.toString();
                    logger.debug({ chunkNo, l, currentSeekStr, currentEndStr }, 'Downloading chunk');

                    const ffmpegArgs = [
                        '-nostdin',
                        '-loglevel', 'error',
                        '-fflags', '+discardcorrupt',
                        '-user_agent', userAgent,
                        '-headers', headers,
                        '-http_seekable', '0',
                        '-rw_timeout', '30000000', // 30秒タイムアウト (マイクロ秒)
                        '-multiple_requests', '1', // HTTP keep-alive
                        '-reconnect', '1',
                        '-reconnect_streamed', '1',
                        '-reconnect_delay_max', '5',
                        '-seekable', '0',
                        '-i', fullUrl,
                        '-acodec', 'copy',
                        '-vn',
                        '-bsf:a', 'aac_adtstoasc',
                        '-y',
                        chunkFile
                    ];

                    let downloadSuccess = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            await this.spawnFfmpeg(ffmpegArgs, `Chunk ${chunkNo} (Attempt ${attempt})`);
                            if (fs.existsSync(chunkFile)) {
                                downloadSuccess = true;
                                break;
                            }
                        } catch (err) {
                            console.warn(`[Recorder] Chunk ${chunkNo} download attempt ${attempt} failed: ${err}`);
                            if (attempt < 3) {
                                // 5秒待機してリトライ
                                await new Promise(resolve => setTimeout(resolve, 5000));
                            }
                        }
                    }

                    if (downloadSuccess) {
                        chunkFiles.push(chunkFile);
                        fs.appendFileSync(fileListPath, `file '${chunkFile}'\n`);
                    } else {
                        throw new Error(`Chunk download failed after 3 attempts: ${chunkFile}`);
                    }

                    leftSec -= l;
                    currentSeekTime += l * 1000;
                    chunkNo++;
                }

                // 結合
                console.log(`[Recorder] チャンク結合中...`);
                // ffmpeg concat demuxer を使用
                const concatArgs = [
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', fileListPath,
                    '-c', 'copy',
                    '-y',
                    outputPath
                ];
                await this.spawnFfmpeg(concatArgs, 'チャンク結合');
                console.log(`[Recorder] タイムフリー録音完了`);

            } catch (e) {
                console.error(`[Recorder] タイムフリー録音エラー`, e);
                // エラー時も一時ファイル削除を行うためスロー
                throw e;
            } finally {
                // 一時ファイル削除
                try {
                    if (fs.existsSync(fileListPath)) fs.unlinkSync(fileListPath);
                    chunkFiles.forEach(f => {
                        if (fs.existsSync(f)) fs.unlinkSync(f);
                    });
                } catch (cleanupErr) {
                    console.error('Core dump cleanup failed', cleanupErr);
                }
            }
        }
    }

    private spawnFfmpeg(args: string[], label: string = 'ffmpeg'): Promise<void> {
        return new Promise((resolve, reject) => {
            const proc = spawn('ffmpeg', args);

            let stderr = '';

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    console.log(`[Recorder] ${label} 成功`);
                    resolve();
                } else {
                    reject(new Error(`${label} failed with code ${code}. Stderr: ${stderr}`));
                }
            });

            proc.on('error', (err) => {
                console.error(`[Recorder] ${label} 起動エラー`, err);
                reject(err);
            });
        });
    }
}
