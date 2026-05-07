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
        const safeFileParam = path.basename(fileParam);
        const recordsDir = path.join(process.cwd(), 'public', 'records');
        const filePath = path.join(recordsDir, safeFileParam);

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        const range = request.headers.get('range');

        const isDownload = url.searchParams.get('download') === 'true';
        const encodedFilename = encodeURIComponent(safeFileParam);

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
        const url = new URL(request.url);
        const fileParam = url.searchParams.get('file');

        let filename = fileParam;
        let filenames: string[] = [];

        try {
            const body = await request.json();
            if (body.filenames && Array.isArray(body.filenames)) {
                filenames = body.filenames;
            } else if (body.filename) {
                filename = body.filename;
            }
        } catch {
            // Ignore JSON parse errors if we don't have a body or it's not JSON
        }

        if (!filename && filenames.length === 0) {
            return NextResponse.json({ error: 'Filename or filenames array is required' }, { status: 400 });
        }

        // If a single filename is provided, put it in the array to unify processing
        if (filename && filenames.length === 0) {
            filenames = [filename];
        }

        const results = [];
        const recordsDir = path.join(process.cwd(), 'public', 'records');

        for (const rawFilename of filenames) {
            // Decode the filename cleanly handles query parameters
            const decodedFilename = decodeURIComponent(rawFilename);
            // Prevent path traversal
            const safeFilename = path.basename(decodedFilename);
            const filePath = path.join(recordsDir, safeFilename);

            // Delete from DB
            const dbResult = drizzleDb.delete(records).where(eq(records.filename, safeFilename)).run();

            // Delete from Filesystem
            let fileDeleted = false;
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    fileDeleted = true;
                } catch (e) {
                    console.error(`Failed to unlink file ${safeFilename}:`, e);
                }
            }

            results.push({
                filename: safeFilename,
                dbChanges: dbResult.changes,
                fileDeleted
            });
        }

        const totalDbChanges = results.reduce((acc, curr) => acc + curr.dbChanges, 0);
        if (totalDbChanges === 0 && filenames.length === 1) {
            return NextResponse.json({ error: `データベース上にファイル ${filenames[0]} の記録が見つかりませんでした` }, { status: 404 });
        }

        return NextResponse.json({ success: true, results });
    } catch (error) {
        const err = error as Error;
        console.error('Error deleting records:', err);
        return NextResponse.json({ error: `Failed to delete records: ${err.message}` }, { status: 500 });
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
