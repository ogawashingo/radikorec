import pino from 'pino';
import path from 'path';
import fs from 'fs';

// Next.js standalone ビルドに必要なモジュールを強制的に含めるための明示的なインポート
// 本番環境で worker を使用しない場合でも、pino の内部構造上、
// これらのモジュールが存在しないとエラーになるケースがあるため。
import 'pino-abstract-transport';

const isDev = process.env.NODE_ENV === 'development';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
        // 環境によってはディレクトリ作成権限がない場合がある
    }
}

const logFile = fs.existsSync(dataDir)
    ? path.join(dataDir, 'app.log')
    : path.join(process.cwd(), 'app.log');

function createLogger() {
    if (isDev) {
        // 開発環境: pino-pretty を使用して読みやすいログを出力
        const transport = pino.transport({
            targets: [
                {
                    target: 'pino/file',
                    options: { destination: logFile },
                    level: 'info'
                },
                {
                    target: 'pino-pretty',
                    options: {
                        colorize: true,
                        ignore: 'pid,hostname',
                        translateTime: 'SYS:standard'
                    },
                    level: 'debug'
                }
            ]
        });
        return pino({ level: 'debug' }, transport);
    } else {
        // 本番環境: Next.js standalone モードでの worker_threads/動的ロードの問題を避けるため、
        // 厳密に worker を使用しない multistream を使用。
        const streams = [
            { stream: process.stdout, level: 'info' as const },
            { stream: fs.createWriteStream(logFile, { flags: 'a' }), level: 'info' as const }
        ];
        return pino(
            {
                level: 'info',
                base: { env: 'production' }
            },
            pino.multistream(streams)
        );
    }
}

export const logger = createLogger();
