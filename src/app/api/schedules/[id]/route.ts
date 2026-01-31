import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// 特定のスケジュール取得 (GET)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);

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
        const { id } = await params;
        const body = await request.json();
        const { station_id, start_time, duration, title, recurring_pattern, day_of_week } = body;

        const stmt = db.prepare(`
            UPDATE schedules 
            SET station_id = ?, start_time = ?, duration = ?, title = ?, recurring_pattern = ?, day_of_week = ?
            WHERE id = ?
        `);

        const result = stmt.run(
            station_id,
            start_time,
            duration,
            title || '',
            recurring_pattern || null,
            day_of_week !== undefined ? day_of_week : null,
            id
        );

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
    try {
        const { id } = await params;
        const stmt = db.prepare('DELETE FROM schedules WHERE id = ?');
        const result = stmt.run(id);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
    }
}
