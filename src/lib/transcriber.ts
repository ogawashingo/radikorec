import { spawn } from 'child_process';
import path from 'path';
import { logger } from '@/lib/logger';

// 文字起こし結果の型定義
export interface TranscriptSegment {
    start: number;
    end: number;
    text: string;
}

export interface TranscriptResult {
    segments: TranscriptSegment[];
    language: string;
    elapsed: number;
    fullText: string; // タイムスタンプ付きの全テキスト
}

/**
 * 指定した音声ファイルを文字起こしする
 * @param audioFilePath 音声ファイルの絶対パス
 * @param model 使用するWhisperモデル（デフォルト: medium）
 */
export async function transcribeAudio(
    audioFilePath: string,
    model: string = 'medium'
): Promise<TranscriptResult> {
    // Python スクリプトのパス
    const scriptPath = path.join(process.cwd(), 'scripts', 'transcribe.py');

    // Python 実行ファイルのパス（環境変数で上書き可能）
    const pythonPath = process.env.PYTHON_PATH || 'python3';

    logger.info({ audioFilePath, model }, '文字起こしを開始します');

    return new Promise((resolve, reject) => {
        const args = [scriptPath, audioFilePath, '--model', model, '--json'];
        const proc = spawn(pythonPath, args, {
            // Python のキャッシュを data ディレクトリに向ける（Docker ボリューム対応）
            env: {
                ...process.env,
                HF_HOME: path.join(process.cwd(), 'data', 'whisper-cache'),
            }
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data: Buffer) => {
            // faster-whisper のダウンロード進捗などは stderr に出るので DEBUG レベルで記録
            const msg = data.toString().trim();
            if (msg) logger.debug({ msg }, 'transcribe.py stderr');
            stderr += msg;
        });

        proc.on('close', (code: number | null) => {
            if (code !== 0) {
                logger.error({ code, stderr }, '文字起こしスクリプトがエラーで終了しました');
                reject(new Error(`文字起こし失敗 (exit code: ${code}): ${stderr.slice(0, 500)}`));
                return;
            }

            try {
                const raw = JSON.parse(stdout.trim());

                if (raw.error) {
                    reject(new Error(raw.error));
                    return;
                }

                // タイムスタンプ付きの全テキストを生成
                const fullText = (raw.segments as TranscriptSegment[])
                    .map(seg => {
                        const startM = Math.floor(seg.start / 60).toString().padStart(2, '0');
                        const startS = Math.floor(seg.start % 60).toString().padStart(2, '0');
                        const endM = Math.floor(seg.end / 60).toString().padStart(2, '0');
                        const endS = Math.floor(seg.end % 60).toString().padStart(2, '0');
                        return `[${startM}:${startS} - ${endM}:${endS}] ${seg.text}`;
                    })
                    .join('\n');

                logger.info({ elapsed: raw.elapsed, segments: raw.segments.length }, '文字起こし完了');

                resolve({
                    segments: raw.segments,
                    language: raw.language,
                    elapsed: raw.elapsed,
                    fullText,
                });
            } catch {
                reject(new Error(`JSON解析失敗: ${stdout.slice(0, 200)}`));
            }
        });

        proc.on('error', (err: Error) => {
            logger.error({ err }, 'Pythonプロセスの起動に失敗しました');
            reject(new Error(`Pythonプロセス起動失敗: ${err.message}`));
        });
    });
}
