import { logger } from '@/lib/logger';
export async function sendDiscordNotification(content: string, embed?: Record<string, unknown>) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.warn('DISCORD_WEBHOOK_URL is not set. Skipping notification.');
        return;
    }

    try {
        const body: Record<string, unknown> = { content };
        if (embed) {
            body.embeds = [embed];
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Discord Webhook failed with status ${response.status}`);
        }
    } catch (error) {
        logger.error({ error }, 'Failed to send Discord notification:');
    }
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
