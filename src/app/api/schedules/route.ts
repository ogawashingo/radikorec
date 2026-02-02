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

        // 一括挿入を処理 (配列)
        if (Array.isArray(body)) {
            const values: any[] = [];
            const placeholders: string[] = [];
            let skippedCount = 0;

            for (const item of body) {
                const { station_id, start_time, duration, title, recurring_pattern, day_of_week } = item;
                if (!station_id || !start_time || !duration) continue;

                // 重複チェック: 同じ駅IDかつ開始時間が2分以内の予約が存在するか確認
                const existing = db.prepare("SELECT id FROM schedules WHERE station_id = ? AND abs(strftime('%s', start_time) - strftime('%s', ?)) < 120").get(
                    station_id,
                    start_time
                );

                if (existing) {
                    skippedCount++;
                    continue; // 重複をスキップ
                }

                placeholders.push('(?, ?, ?, ?, ?, ?)');
                values.push(station_id, start_time, duration, title || '', recurring_pattern || null, day_of_week !== undefined ? day_of_week : null);
            }

            if (values.length === 0) {
                if (skippedCount > 0) {
                    return NextResponse.json({ success: true, count: 0, skipped: skippedCount, message: 'All items were duplicates.' }, { status: 200 });
                }
                return NextResponse.json({ error: 'No valid schedules' }, { status: 400 });
            }

            const sql = `INSERT INTO schedules (station_id, start_time, duration, title, recurring_pattern, day_of_week) VALUES ${placeholders.join(', ')}`;
            const result = db.prepare(sql).run(...values);

            return NextResponse.json({ success: true, count: result.changes, skipped: skippedCount }, { status: 201 });
        }

        // 単一挿入を処理 (オブジェクト)
        const { station_id, start_time, duration, title, recurring_pattern, day_of_week } = body;

        if (!station_id || !start_time || !duration) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 単一挿入の重複チェック
        const existing = db.prepare("SELECT id FROM schedules WHERE station_id = ? AND abs(strftime('%s', start_time) - strftime('%s', ?)) < 120").get(
            station_id,
            start_time
        );

        if (existing) {
            return NextResponse.json({ error: 'Duplicate schedule' }, { status: 409 });
        }

        const stmt = db.prepare(`
      INSERT INTO schedules (station_id, start_time, duration, title, recurring_pattern, day_of_week)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        const result = stmt.run(station_id, start_time, duration, title || '', recurring_pattern || null, day_of_week !== undefined ? day_of_week : null);

        return NextResponse.json({ id: result.lastInsertRowid, ...body }, { status: 201 });
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    // クエリパラメータまたは動的ルートで削除を処理する方が通常はクリーンですが、
    // 別ファイルで処理します。
    // [id]ルートをDELETEに使用します。
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
