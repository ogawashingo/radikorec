const https = require('https');
const http = require('http');

function sendDiscordNotification(message) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const data = JSON.stringify({
        content: `🚨 **[RadikoRec] プロセスで致命的なエラーが発生しました**\n\`\`\`\n${message}\n\`\`\``
    });

    const url = new URL(webhookUrl);
    const client = url.protocol === 'https:' ? https : http;

    const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
        },
    };

    const req = client.request(options, (res) => {
        // レスポンスのハンドリング（今回は無視）
    });

    req.on('error', (error) => {
        console.error('Failed to send Discord Webhook:', error);
    });

    req.write(data);
    req.end();
}

function handleErrorAndExit(err, type) {
    console.error(`${type}:`, err);
    const message = err instanceof Error ? (err.stack || err.message) : String(err);
    sendDiscordNotification(`[${type}]\n${message}`);

    // Webhookの送信が完了するのを少し待ってから終了する
    setTimeout(() => {
        process.exit(1);
    }, 3000);
}

process.on('uncaughtException', (err) => {
    handleErrorAndExit(err, 'Uncaught Exception');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    handleErrorAndExit(reason, 'Unhandled Rejection');
});

process.on('SIGTERM', () => {
    // Docker等からコンテナ停止要求が来た場合は通常終了
    process.exit(0);
});

// 本体（Next.js の standalone サーバー）を起動する
require('./server.js');
