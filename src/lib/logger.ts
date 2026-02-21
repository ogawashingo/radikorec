import pino from 'pino';
import path from 'path';
import fs from 'fs';

const isDev = process.env.NODE_ENV === 'development';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch {
        // ディレクトリ作成に失敗しても処理は続行
    }
}

// ログファイルへの書き込みが可能か事前にチェックする
function canWriteLogFile(): string | null {
    const logFile = fs.existsSync(dataDir)
        ? path.join(dataDir, 'app.log')
        : path.join(process.cwd(), 'app.log');
    try {
        // 追記モードで書き込み可能か確認
        fs.accessSync(path.dirname(logFile), fs.constants.W_OK);
        return logFile;
    } catch {
        return null;
    }
}

// serverExternalPackages により pino 関連パッケージはバンドル対象外となるため、
// pino.transport (Worker) を安全に使用できます。
function createTransport() {
    const logFile = canWriteLogFile();
    const targets: pino.TransportTargetOptions[] = [];

    // ログファイルへの出力（書き込み可能な場合のみ）
    if (logFile) {
        targets.push({
            target: 'pino/file',
            options: { destination: logFile },
            level: 'info'
        });
    }

    if (isDev) {
        // 開発環境: pino-pretty で色付き出力
        targets.push({
            target: 'pino-pretty',
            options: {
                colorize: true,
                ignore: 'pid,hostname',
                translateTime: 'SYS:standard'
            },
            level: 'debug'
        });
    } else {
        // 本番環境: 標準出力に JSON 形式で出力
        targets.push({
            target: 'pino/file',
            options: { destination: 1 },
            level: 'info'
        });
    }

    return pino.transport({ targets });
}

export const logger = pino(
    {
        level: isDev ? 'debug' : 'info',
        base: {
            env: process.env.NODE_ENV
        }
    },
    createTransport()
);
