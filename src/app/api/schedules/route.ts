import { NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { schedules } from '@/lib/schema';
import { desc, sql } from 'drizzle-orm';

export async function GET() {
    try {
        const allSchedules = drizzleDb.select().from(schedules).orderBy(desc(schedules.start_time)).all();
        return NextResponse.json(allSchedules);
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
            const valuesToInsert: typeof schedules.$inferInsert[] = [];
            let skippedCount = 0;

            for (const item of body) {
                const { station_id, start_time, duration, title, recurring_pattern, day_of_week, is_realtime } = item;
                if (!station_id || !start_time || !duration) continue;

                // 重複チェック: 同じ駅IDかつ開始時間が2分以内の予約が存在するか確認
                const existing = drizzleDb.select({ id: schedules.id }).from(schedules)
                    .where(sql`${schedules.station_id} = ${station_id} AND abs(strftime('%s', ${schedules.start_time}) - strftime('%s', ${start_time})) < 120`)
                    .get();

                if (existing) {
                    skippedCount++;
                    continue; // 重複をスキップ
                }

                valuesToInsert.push({
                    station_id,
                    start_time,
                    duration,
                    title: title || '',
                    recurring_pattern: recurring_pattern || null,
                    day_of_week: day_of_week !== undefined ? day_of_week : null,
                    is_realtime: is_realtime ? 1 : 0
                });
            }

            if (valuesToInsert.length === 0) {
                if (skippedCount > 0) {
                    return NextResponse.json({ success: true, count: 0, skipped: skippedCount, message: 'All items were duplicates.' }, { status: 200 });
                }
                return NextResponse.json({ error: 'No valid schedules' }, { status: 400 });
            }

            const result = drizzleDb.insert(schedules).values(valuesToInsert).run();

            return NextResponse.json({ success: true, count: result.changes, skipped: skippedCount }, { status: 201 });
        }

        // 単一挿入を処理 (オブジェクト)
        const { station_id, start_time, duration, title, recurring_pattern, day_of_week, is_realtime } = body;

        if (!station_id || !start_time || !duration) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 単一挿入の重複チェック
        const existing = drizzleDb.select({ id: schedules.id }).from(schedules)
            .where(sql`${schedules.station_id} = ${station_id} AND abs(strftime('%s', ${schedules.start_time}) - strftime('%s', ${start_time})) < 120`)
            .get();

        if (existing) {
            return NextResponse.json({ error: 'Duplicate schedule' }, { status: 409 });
        }

        const result = drizzleDb.insert(schedules).values({
            station_id,
            start_time,
            duration,
            title: title || '',
            recurring_pattern: recurring_pattern || null,
            day_of_week: day_of_week !== undefined ? day_of_week : null,
            is_realtime: is_realtime ? 1 : 0
        }).returning().get();

        return NextResponse.json(result, { status: 201 });
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
