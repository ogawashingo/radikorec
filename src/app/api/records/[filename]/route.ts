import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
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

            // @ts-ignore: ReadableStream compatible
            return new NextResponse(file, { status: 206, headers });
        } else {
            headers.set('Content-Length', fileSize.toString());
            const file = fs.createReadStream(filePath);
            // @ts-ignore: ReadableStream compatible
            return new NextResponse(file, { status: 200, headers });
        }

    } catch (error) {
        console.error('Error serving record:', error);
        return NextResponse.json({ error: 'Failed to serve record' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await params;
        const recordsDir = path.join(process.cwd(), 'public', 'records');
        const filePath = path.join(recordsDir, filename);

        // Delete from DB
        const stmt = db.prepare('DELETE FROM records WHERE filename = ?');
        const result = stmt.run(filename);

        if (result.changes === 0) {
            // Even if not in DB, try to delete file? Or return 404?
            // Proceed to delete file if exists to clean up
        }

        // Delete from Filesystem
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting record:', error);
        return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await params;
        const { is_watched } = await request.json();

        if (typeof is_watched !== 'number') {
            return NextResponse.json({ error: 'is_watched must be a number (0 or 1)' }, { status: 400 });
        }

        const stmt = db.prepare('UPDATE records SET is_watched = ? WHERE filename = ?');
        const result = stmt.run(is_watched, filename);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating record:', error);
        return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }
}
