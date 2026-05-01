/* eslint-disable @typescript-eslint/no-require-imports */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// data ディレクトリは永続化されているため、コンテナ再起動時も状態が保持される
const THROTTLE_FILE = path.join(__dirname, 'data', '.last_discord_error');
const THROTTLE_TIME_MS = 15 * 60 * 1000; // 15分

function sendDiscordNotification(message) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    // 通知の頻度制限 (15分に1回)
    try {
        if (fs.existsSync(THROTTLE_FILE)) {
            const lastTime = parseInt(fs.readFileSync(THROTTLE_FILE, 'utf8'), 10);
            if (!isNaN(lastTime) && Date.now() - lastTime < THROTTLE_TIME_MS) {
                console.log('Discord notification skipped due to throttling. (Sent within the last 15 minutes)');
                return; // 制限時間内なので送信をスキップ
            }
        }
    } catch (e) {
        console.error('Failed to read throttle file:', e);
    }

    // 現在の送信時刻を記録
    try {
        fs.writeFileSync(THROTTLE_FILE, Date.now().toString(), 'utf8');
    } catch (e) {
        console.error('Failed to write throttle file:', e);
    }

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

    const req = client.request(options, () => {
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
