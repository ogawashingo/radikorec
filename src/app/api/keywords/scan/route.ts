import { NextResponse } from 'next/server';
import { scanAndReserve } from '@/lib/scanner';

export async function POST() {
    try {
        // Trigger generic scan (no await needed for fast response? No, wait to report success/count is better if fast enough. But scanner has delays. It might take time.)
        // But user wants to know it started. 
        // We can await it but it might time out if many keywords.
        // Let's await it for now, as keywords likely few.
        await scanAndReserve();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Scan failed:', error);
        return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
    }
}
