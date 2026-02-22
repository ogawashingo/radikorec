import { NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { schedules } from '@/lib/schema';
import { desc } from 'drizzle-orm';
import { checkCrossTypeDuplicate, checkSameTypeDuplicate } from '@/lib/schedules-service';

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
            // 配列の最初の要素から force フラグを取得
            const force = body[0]?.force === true;
            const valuesToInsert: typeof schedules.$inferInsert[] = [];
            let skippedCount = 0;
            const crossDuplicates: string[] = [];

            for (const item of body) {
                const { station_id, start_time, duration, title, recurring_pattern, day_of_week, is_realtime } = item;
                if (!station_id || !start_time || !duration) continue;

                // 同型の重複チェック: 同じ放送局かつ開始時間が2分以内の予約が存在するか確認
                const isDuplicate = checkSameTypeDuplicate(station_id, start_time);

                if (isDuplicate) {
                    skippedCount++;
                    continue; // 重複をスキップ
                }

                // クロスタイプの重複チェック（force でない場合のみ）
                if (!force) {
                    const crossDup = checkCrossTypeDuplicate(
                        station_id,
                        start_time,
                        recurring_pattern || null,
                        day_of_week !== undefined ? day_of_week : null,
                    );
                    if (crossDup) {
                        crossDuplicates.push(crossDup);
                        continue;
                    }
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

            // クロスタイプ重複が検出された場合は 409 を返す
            if (crossDuplicates.length > 0 && valuesToInsert.length === 0) {
                return NextResponse.json({
                    error: 'Duplicate schedule',
                    duplicateType: 'cross',
                    existingTitles: crossDuplicates,
                    message: `同じ放送局・曜日・時刻の予約が既に存在します: ${crossDuplicates.join(', ')}`,
                }, { status: 409 });
            }

            if (valuesToInsert.length === 0) {
                if (skippedCount > 0) {
                    return NextResponse.json({ success: true, count: 0, skipped: skippedCount, message: 'All items were duplicates.' }, { status: 200 });
                }
                return NextResponse.json({ error: 'No valid schedules' }, { status: 400 });
            }

            const result = drizzleDb.insert(schedules).values(valuesToInsert).run();

            return NextResponse.json({
                success: true,
                count: result.changes,
                skipped: skippedCount,
                crossDuplicateSkipped: crossDuplicates.length,
            }, { status: 201 });
        }

        // 単一挿入を処理 (オブジェクト)
        const { station_id, start_time, duration, title, recurring_pattern, day_of_week, is_realtime, force } = body;

        if (!station_id || !start_time || !duration) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 同型の重複チェック
        const isDuplicate = checkSameTypeDuplicate(station_id, start_time);

        if (isDuplicate) {
            return NextResponse.json({ error: 'Duplicate schedule' }, { status: 409 });
        }

        // クロスタイプの重複チェック（force でない場合のみ）
        if (!force) {
            const crossDup = checkCrossTypeDuplicate(
                station_id,
                start_time,
                recurring_pattern || null,
                day_of_week !== undefined ? day_of_week : null,
            );
            if (crossDup) {
                return NextResponse.json({
                    error: 'Duplicate schedule',
                    duplicateType: 'cross',
                    existingTitle: crossDup,
                    message: `同じ放送局・曜日・時刻の予約が既に存在します: ${crossDup}`,
                }, { status: 409 });
            }
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

export async function DELETE() {
    // クエリパラメータまたは動的ルートで削除を処理する方が通常はクリーンですが、
    // 別ファイルで処理します。
    // [id]ルートをDELETEに使用します。
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
