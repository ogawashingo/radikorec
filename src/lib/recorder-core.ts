import { spawn } from 'child_process';
import crypto from 'crypto';
import { RadikoClient } from './radiko';
import path from 'path';

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
        console.log(`[Recorder] 録音を開始します: ${stationId} (リアルタイム: ${isRealtime})`);

        // 1. 認証 (エリアIDと認証トークンの取得)
        const auth = await this.client.getAuthToken();

        let fullUrl: string;
        const durationSec = durationMin * 60;

        if (isRealtime) {
            // リアルタイム録音
            const liveStreamUrl = await this.client.getLiveStreamBaseUrl(stationId);
            const lsid = this.getLsid();

            // ライブストリームの場合、station_id と lsid が必要。
            const url = new URL(liveStreamUrl);
            url.searchParams.set('station_id', stationId);
            url.searchParams.set('l', '15'); // チャンク長？（HLSの一般的な設定）
            url.searchParams.set('lsid', lsid);
            url.searchParams.set('type', 'b'); // ライブ放送は通常 type=b

            fullUrl = url.toString();
            console.log(`[Recorder] Live URL: ${fullUrl}`);
        } else {
            // タイムフリー録音
            const streamBaseUrl = await this.client.getStreamBaseUrl(stationId);
            const endTime = new Date(startTime.getTime() + durationMin * 60000);

            const ft = this.formatRadikoDate(startTime);
            const to = this.formatRadikoDate(endTime);
            const lsid = this.getLsid();

            const url = new URL(streamBaseUrl);
            url.searchParams.set('station_id', stationId);
            url.searchParams.set('start_at', ft);
            url.searchParams.set('ft', ft);
            url.searchParams.set('end_at', to);
            url.searchParams.set('to', to);
            url.searchParams.set('seek', ft);
            url.searchParams.set('l', String(durationSec)); // 秒単位の期間
            url.searchParams.set('lsid', lsid);
            url.searchParams.set('type', 'c');

            fullUrl = url.toString();
            currentUrl = url;
            console.log(`[Recorder] TimeFree URL: ${fullUrl}`);
        }

        // 3. FFMPEG の実行
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

        // FFMpegの -headers オプション用
        // 注意: User-Agent は -user_agent オプションで指定する方が安全
        const headers = `X-Radiko-Authtoken: ${auth.authtoken}\r\n`;

        // デバッグ用: ユーザーが手動で試せるCURLコマンドを出力
        const curlCmd = `curl -v -H "X-Radiko-Authtoken: ${auth.authtoken}" -H "User-Agent: ${userAgent}" "${currentUrl}"`;
        console.log(`[Debug] Curl Command:\n${curlCmd}`);

        const ffmpegArgs = [
            '-nostdin',
            '-loglevel', 'error', // デバッグ時は info に変更
            '-fflags', '+discardcorrupt',
            '-user_agent', userAgent, // User-Agent は -user_agent で指定
            '-headers', headers, // その他のヘッダー
            '-http_seekable', '0', // ライブ・タイムフリー問わず必要そう
            '-seekable', '0',
            '-i', fullUrl
        ];

        if (isRealtime) {
            // ライブ録音の場合は -t (時間) で停止させる
            ffmpegArgs.push('-t', String(durationSec));
        }

        ffmpegArgs.push(
            '-acodec', 'copy',
            '-vn',
            '-bsf:a', 'aac_adtstoasc',
            '-y',
            outputPath
        );

        await this.spawnFfmpeg(ffmpegArgs);
    }

    private spawnFfmpeg(args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`[Recorder] ffmpegプロセスを起動します...`);
            const proc = spawn('ffmpeg', args);

            let stderr = '';

            proc.stdout.on('data', (data) => {
                // console.log(`[ffmpeg stdout] ${data}`);
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    console.log(`[Recorder] 録音成功`);
                    resolve();
                } else {
                    console.error(`[Recorder] 失敗 (コード: ${code})`);
                    console.error(`[Recorder] Stderr: ${stderr}`);
                    reject(new Error(`ffmpeg exited with code ${code}. Stderr: ${stderr}`));
                }
            });

            proc.on('error', (err) => {
                console.error(`[Recorder] 起動エラー`, err);
                reject(err);
            });
        });
    }
}
