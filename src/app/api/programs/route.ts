import { NextResponse } from 'next/server';
import { RadikoClient } from '@/lib/radiko';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('station');
    const date = searchParams.get('date'); // YYYYMMDD

    if (!stationId || !date) {
        return NextResponse.json({ error: 'Missing station or date' }, { status: 400 });
    }

    try {
        const client = new RadikoClient();
        const programs = await client.getProgramSchedule(stationId, date);

        // フロントエンドの期待する形式にマッピング
        const formattedPrograms = programs.map(p => {
            // p.start_time は "YYYY-MM-DD HH:mm:ss" です

            const start = new Date(p.start_time);

            // 表示時刻のロジック (25:00 など)

            // 表示時刻を再構築
            const hours = start.getHours();
            const minutes = String(start.getMinutes()).padStart(2, '0');

            // リクエストされた日付文字列 "YYYYMMDD"
            // 番組の日付文字列 "YYYYMMDD"
            const pYear = start.getFullYear();
            const pMonth = String(start.getMonth() + 1).padStart(2, '0');
            const pDay = String(start.getDate()).padStart(2, '0');
            const pDateStr = `${pYear}${pMonth}${pDay}`;

            let displayHours = hours;
            if (pDateStr > date) {
                displayHours += 24;
            }

            const displayTime = `${String(displayHours).padStart(2, '0')}:${minutes}`;
            const timeStr = `${String(hours).padStart(2, '0')}:${minutes}`;

            return {
                title: p.title,
                start: p.start_time, // 互換性のあるフォーマットを維持
                time: timeStr,
                displayTime: displayTime,
                duration: Math.round((new Date(p.end_time).getTime() - start.getTime()) / 60000), // 分単位の長さ
                performer: p.performer,
                info: p.description, // descriptionをinfo/descにマッピング
                desc: p.description
            };
        });

        return NextResponse.json(formattedPrograms);

    } catch (error) {
        console.error('Failed to fetch programs:', error);
        return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 });
    }
}
