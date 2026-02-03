import { NextResponse } from 'next/server';
import { RadikoClient } from '@/lib/radiko';

const radiko = new RadikoClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { keyword } = body;

        if (!keyword) {
            return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
        }

        console.log(`Preview search for: ${keyword}`);
        const programs = await radiko.search(keyword);

        // Ensure only future programs (or currently playing) are returned
        const now = new Date();
        const futurePrograms = programs.filter(p => new Date(p.end_time) > now);

        return NextResponse.json({ programs: futurePrograms });
    } catch (error) {
        console.error('Preview search failed:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
