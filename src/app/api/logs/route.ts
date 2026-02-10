import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const logFile = path.join(process.cwd(), 'data', 'app.log');
    const fallbackLogFile = path.join(process.cwd(), 'app.log');

    const targetFile = fs.existsSync(logFile) ? logFile : fallbackLogFile;

    if (!fs.existsSync(targetFile)) {
        return NextResponse.json({ logs: [] });
    }

    try {
        const content = fs.readFileSync(targetFile, 'utf8');
        const lines = content.trim().split('\n').reverse().slice(0, 100);

        const logs = lines.map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return { msg: line, time: new Date().toISOString(), level: 30 };
            }
        });

        return NextResponse.json({ logs });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to read logs' }, { status: 500 });
    }
}
