import pino from 'pino';
import path from 'path';
import fs from 'fs';

// Node.js v20+ / Next.js standalone 環境において、pino.transport (Worker) は
// 依存モジュールの解決エラーを引き起こしやすいため、使用を完全に避けます。

const isDev = process.env.NODE_ENV === 'development';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
        // ディレクトリ作成に失敗しても処理は続行
    }
}

const logFile = fs.existsSync(dataDir)
    ? path.join(dataDir, 'app.log')
    : path.join(process.cwd(), 'app.log');

function createLogger() {
    // 開発・本番ともに Worker を使わない同期的出力 (multistream) に統一します。
    // これにより Next.js standalone ビルド時の依存関係トレース問題を回避します。
    const streams = [
        { stream: process.stdout, level: isDev ? ('debug' as const) : ('info' as const) },
        { stream: fs.createWriteStream(logFile, { flags: 'a' }), level: 'info' as const }
    ];

    return pino(
        {
            level: isDev ? 'debug' : 'info',
            base: {
                env: process.env.NODE_ENV
            }
        },
        pino.multistream(streams)
    );
}

export const logger = createLogger();
