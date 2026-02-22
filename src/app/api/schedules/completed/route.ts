import { NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { schedules } from '@/lib/schema';
import { inArray } from 'drizzle-orm';

export async function DELETE() {
    try {
        const result = drizzleDb.delete(schedules)
            .where(inArray(schedules.status, ['completed', 'failed']))
            .run();

        return NextResponse.json({ success: true, count: result.changes });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to delete completed schedules' }, { status: 500 });
    }
}
