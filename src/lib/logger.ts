import pino from 'pino';

// Node.js v20+ / Next.js standalone 環境での Worker エラーを回避するため、
// ロギングを極限までシンプルにします。

const isDev = process.env.NODE_ENV === 'development';

function createLogger() {
    if (isDev) {
        // 開発環境: 本番環境でのエラー切り分けのため、一時的に標準構成にします。
        return pino({ level: 'debug' });
    } else {
        // 本番環境: デバッグメッセージを直接標準出力に出して、このコードが呼ばれているか確認します。
        process.stdout.write("--- [DEBUG] LOGGER INITIALIZING (MINIMAL MODE) ---\n");
        // 最も基本的な構成。これでエラーが出る場合は pino ライブラリ側の問題です。
        return pino({ level: 'info' });
    }
}

export const logger = createLogger();
