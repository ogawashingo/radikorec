import pino from 'pino';
import path from 'path';
import fs from 'fs';

const isDev = process.env.NODE_ENV === 'development';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
        // In some environments, we might not have permission to create the directory
    }
}

const logFile = fs.existsSync(dataDir)
    ? path.join(dataDir, 'app.log')
    : path.join(process.cwd(), 'app.log');

function createLogger() {
    if (isDev) {
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
        // Production: Use multistream to avoid worker_threads/dynamic loading issues
        // in Next.js standalone mode.
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
