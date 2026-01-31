import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    try {
        const schedules = db.prepare('SELECT * FROM schedules ORDER BY start_time DESC').all();
        return NextResponse.json(schedules);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { station_id, start_time, duration, title, recurring_pattern, day_of_week } = body;

        if (!station_id || !start_time || !duration) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const stmt = db.prepare(`
      INSERT INTO schedules (station_id, start_time, duration, title, recurring_pattern, day_of_week)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(station_id, start_time, duration, title || '', recurring_pattern || null, day_of_week !== undefined ? day_of_week : null);

        // TODO: スケジューラーに通知して新しいジョブをピックアップさせる
        // (現状は1分ごとのポーリングなので通知は必須ではない)

        return NextResponse.json({ id: result.lastInsertRowid, ...body }, { status: 201 });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    // Handling delete via query param or dynamic route is cleaner in separate file usually,
    // but for simple cases we can check searchParams if strictly needed here, 
    // though [id]/route.ts is Next.js standard.
    // I will use [id] route for DELETE.
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
