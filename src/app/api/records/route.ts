import { NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { records } from '@/lib/schema';
import { desc, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const fileParam = url.searchParams.get('file');

        if (!fileParam) {
            // No file param, return list of records
            const allRecords = drizzleDb.select().from(records).orderBy(desc(records.created_at)).all();
            return NextResponse.json(allRecords);
        }

        // File param exists, stream the file
        const recordsDir = path.join(process.cwd(), 'public', 'records');
        const filePath = path.join(recordsDir, fileParam);

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        const range = request.headers.get('range');

        const isDownload = url.searchParams.get('download') === 'true';
        const encodedFilename = encodeURIComponent(fileParam);

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

            return new NextResponse(file as unknown as ReadableStream, { status: 206, headers });
        } else {
            headers.set('Content-Length', fileSize.toString());
            const file = fs.createReadStream(filePath);
            return new NextResponse(file as unknown as ReadableStream, { status: 200, headers });
        }

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { filename } = await request.json();
        const recordsDir = path.join(process.cwd(), 'public', 'records');
        const filePath = path.join(recordsDir, filename);

        // Delete from DB
        const result = drizzleDb.delete(records).where(eq(records.filename, filename)).run();

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

export async function PATCH(request: Request) {
    try {
        const { filename, is_watched } = await request.json();

        if (typeof is_watched !== 'number') {
            return NextResponse.json({ error: 'is_watched must be a number (0 or 1)' }, { status: 400 });
        }

        const result = drizzleDb.update(records)
            .set({ is_watched })
            .where(eq(records.filename, filename))
            .run();

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating record:', error);
        return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }
}
