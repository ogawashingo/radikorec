import { NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { records } from '@/lib/schema';
import { desc, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const allRecords = drizzleDb.select().from(records).orderBy(desc(records.created_at)).all();

        // Optional: Verify file existence (might be slow if many files, skipping for now or doing lazily)

        return NextResponse.json(allRecords);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
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
