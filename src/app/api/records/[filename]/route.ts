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

        const fileBuffer = fs.readFileSync(filePath);

        // Determine mode based on query param
        const url = new URL(request.url);
        const isDownload = url.searchParams.get('download') === 'true';

        const headers = new Headers();
        headers.set('Content-Type', 'audio/mp4');
        const encodedFilename = encodeURIComponent(filename);
        headers.set('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename*=UTF-8''${encodedFilename}`);

        return new NextResponse(fileBuffer, { status: 200, headers });
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
