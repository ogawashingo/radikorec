import pino from 'pino';
import path from 'path';
import fs from 'fs';

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

// serverExternalPackages により pino 関連パッケージはバンドル対象外となるため、
// pino.transport (Worker) を安全に使用できます。
const transport = pino.transport({
    targets: [
        {
            target: 'pino/file',
            options: { destination: logFile },
            level: 'info'
        },
        ...(isDev
            ? [{
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    ignore: 'pid,hostname',
                    translateTime: 'SYS:standard'
                },
                level: 'debug' as const
            }]
            : [{
                // 本番環境: 標準出力に JSON 形式で出力
                target: 'pino/file',
                options: { destination: 1 },
                level: 'info' as const
            }]
        )
    ]
});

export const logger = pino(
    {
        level: isDev ? 'debug' : 'info',
        base: {
            env: process.env.NODE_ENV
        }
    },
    transport
);
