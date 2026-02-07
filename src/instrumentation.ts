export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Node.js 18+ (verified in v22) fetch implementation issue workaround
        // Suppress 'ReadableStream is already closed' errors which are harmless but crash the process
        const originalConsoleError = console.error;
        const suppressErrors = [
            'ReadableStream is already closed',
            'ERR_INVALID_STATE'
        ];

        process.on('uncaughtException', (err) => {
            if (err && err.message && suppressErrors.some(msg => err.message.includes(msg))) {
                // Silently ignore or log as warning
                // console.warn('Suppressed known Node.js fetch error:', err.message);
                return;
            }
            console.error('Uncaught Exception:', err);
            // Don't exit process for these errors in development/production if possible, 
            // but usually uncaughtException allows process to continue if handled? 
            // Actually, in default Node, it exits. We should be careful.
            // Next.js might have its own handlers.
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            const err = reason as Error;
            if (err && err.message && suppressErrors.some(msg => err.message.includes(msg))) {
                return;
            }
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        const { initScheduler } = await import('@/lib/scheduler');
        initScheduler();
    }
}
