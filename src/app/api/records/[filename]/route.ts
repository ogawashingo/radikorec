import { NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { records } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await params;
        const recordsDir = path.join(process.cwd(), 'public', 'records');
        const filePath = path.join(recordsDir, filename);

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        const range = request.headers.get('range');

        const url = new URL(request.url);
        const isDownload = url.searchParams.get('download') === 'true';
        const encodedFilename = encodeURIComponent(filename);

        const headers = new Headers();
        headers.set('Content-Type', 'audio/mp4');
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename*=UTF-8''${encodedFilename}`);

        if (range && !isDownload) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize) {
                return new NextResponse(null, {
                    status: 416,
                    headers: { 'Content-Range': `bytes */${fileSize}` }
                });
            }

            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });

            headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            headers.set('Content-Length', chunksize.toString());

            // Cast Node.js ReadStream to Web ReadableStream
            return new NextResponse(file as unknown as ReadableStream, { status: 206, headers });
        } else {
            headers.set('Content-Length', fileSize.toString());
            const file = fs.createReadStream(filePath);
            // Cast Node.js ReadStream to Web ReadableStream
            return new NextResponse(file as unknown as ReadableStream, { status: 200, headers });
        }

    } catch (error) {
        console.error('Error serving record:', error);
        return NextResponse.json({ error: 'Failed to serve record' }, { status: 500 });
    }
}


