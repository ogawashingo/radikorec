import { NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { keywords } from '@/lib/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
    try {
        const allKeywords = drizzleDb.select().from(keywords).orderBy(desc(keywords.created_at)).all();
        return NextResponse.json(allKeywords);
    } catch (error) {
        console.error('Failed to fetch keywords:', error);
        return NextResponse.json({ error: 'Failed to fetch keywords' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { keyword } = body;

        if (!keyword) {
            return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
        }

        const result = drizzleDb.insert(keywords).values({
            keyword,
            enabled: 1,
            prevent_duplicates: 1
        }).returning().get();

        return NextResponse.json(result);
    } catch (error) {
        console.error('Failed to create keyword:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: `Failed to create keyword: ${errorMessage}` }, { status: 500 });
    }
}
