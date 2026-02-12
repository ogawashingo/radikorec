import { NextResponse } from 'next/server';
import { downloadManager } from '@/lib/download-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
    const jobs = downloadManager.getJobs();
    return NextResponse.json(jobs);
}
