import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scanAndReserve } from '@/lib/scanner'; // Import for manual trigger if needed? 
// 手動トリガーは別のアクションまたはパラメータとして実装する方が良いかもしれません。
// GET/POSTをシンプルに保ちましょう。

export async function GET() {
    try {
        const keywords = db.prepare('SELECT * FROM keywords ORDER BY created_at DESC').all();
        return NextResponse.json(keywords);
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

        const stmt = db.prepare('INSERT INTO keywords (keyword, enabled) VALUES (?, 1)');
        const result = stmt.run(keyword);

        return NextResponse.json({
            id: result.lastInsertRowid,
            keyword,
            enabled: 1,
            created_at: new Date().toISOString() // Approximate
        });
    } catch (error) {
        console.error('Failed to create keyword:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: `Failed to create keyword: ${errorMessage}` }, { status: 500 });
    }
}
