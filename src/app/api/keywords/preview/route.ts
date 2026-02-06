import { NextResponse } from 'next/server';
import { RadikoClient } from '@/lib/radiko';

const radiko = new RadikoClient();

export async function POST(request: Request) {
    try {
        const { keyword, filter } = await request.json();

        if (!keyword) {
            return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
        }

        console.log(`Preview search for: ${keyword}`);
        const programs = await radiko.search(keyword, filter || 'future');

        let resultPrograms = programs;

        // filter指定がない、または 'future' の場合のみ、未来フィルターを適用
        // 'past' の場合はそのまま返す
        if (!filter || filter === 'future') {
            const now = new Date();
            resultPrograms = programs.filter(p => new Date(p.end_time) > now);
        }

        return NextResponse.json({ programs: resultPrograms });
    } catch (error) {
        console.error('Preview search failed:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
