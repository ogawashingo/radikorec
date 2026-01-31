import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const records = db.prepare('SELECT * FROM records ORDER BY created_at DESC').all();

        // Optional: Verify file existence (might be slow if many files, skipping for now or doing lazily)

        return NextResponse.json(records);
    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
    }
}
