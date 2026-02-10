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

const targets: any[] = [
    {
        target: 'pino/file',
        options: { destination: logFile },
        level: 'info'
    }
];

if (isDev) {
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
    // In production, we output JSON to stdout
    targets.push({
        target: 'pino/file',
        options: { destination: 1 }, // 1 is stdout
        level: 'info'
    });
}

const transport = pino.transport({ targets });

export const logger = pino(
    {
        level: isDev ? 'debug' : 'info',
        base: {
            env: process.env.NODE_ENV
        }
    },
    transport
);
