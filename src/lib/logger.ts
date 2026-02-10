import pino from 'pino';
import path from 'path';
import fs from 'fs';

// Force Next.js standalone to include these modules by using them or importing them
// In production, pino-abstract-transport is needed by pino internally even if not using workers sometimes,
// or at least it must be present for the worker thread file to be happy if it's accidentally required.
import 'pino-abstract-transport';

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
        // Use pino-pretty in development
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
        // Production: Strictly avoid worker threads by using multistream
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
