import { NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { schedules } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// 特定のスケジュール取得 (GET)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const schedule = drizzleDb.select().from(schedules).where(eq(schedules.id, Number(id))).get();

        if (!schedule) {
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
        }

        return NextResponse.json(schedule);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
    }
}

// スケジュール更新 (PUT)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const body = await request.json();
        const { station_id, start_time, duration, title, recurring_pattern, day_of_week, is_realtime } = body;
        const { id } = await params;

        const result = drizzleDb.update(schedules)
            .set({
                station_id,
                start_time,
                duration,
                title,
                recurring_pattern,
                day_of_week,
                is_realtime: is_realtime ? 1 : 0,
                status: 'pending',
                error_message: null
            })
            .where(eq(schedules.id, Number(id)))
            .run();

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, ...body });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    console.log('[API] DELETE schedule request received');
    try {
        const { id } = await params;
        console.log(`[API] Deleting schedule ID: ${id}`);

        const result = drizzleDb.delete(schedules).where(eq(schedules.id, Number(id))).run();
        console.log(`[API] Delete result:`, result);

        if (result.changes === 0) {
            console.warn(`[API] Schedule ID ${id} not found for deletion`);
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Database error during deletion:', error);
        return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
    }
}
