import { NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { records } from '@/lib/schema';
import { desc } from 'drizzle-orm';

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
