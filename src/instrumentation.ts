export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Node.js 18+ (verified in v22) の fetch 実装における既知の問題への回避策
        // 'ReadableStream is already closed' エラーは無害ですが、プロセスをクラッシュさせるため抑制します
        const suppressErrors = [
            'ReadableStream is already closed',
            'ERR_INVALID_STATE'
        ];

        process.on('uncaughtException', (err) => {
            if (err && err.message && suppressErrors.some(msg => err.message.includes(msg))) {
                // 警告としてログ出力するか、完全に無視します
                // console.warn('既知の Node.js fetch エラーを抑制しました:', err.message);
                return;
            }
            console.error('Uncaught Exception:', err);
            // 本番/開発環境でこれらのエラーでプロセスを終了させないようにします
            // ただし、通常 uncaughtException はプロセスを終了させるべきですが、
            // 今回は特定のノイズエラーのみを除外しています。
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            const err = reason as Error;
            if (err && err.message && suppressErrors.some(msg => err.message.includes(msg))) {
                return;
            }
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        // 翻訳: スケジューラの初期化
        const { initScheduler } = await import('@/lib/scheduler');
        initScheduler();
    }
}
