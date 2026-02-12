import { NextResponse } from 'next/server';
import { recordRadiko } from '@/lib/recorder';
import { downloadManager } from '@/lib/download-manager';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { station_id, start_time, duration, title } = body;

        if (!station_id || !start_time || !duration) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const safeTitle = title || `Program_${station_id}`;
        console.log(`Manual download requested: ${safeTitle} (${station_id})`);

        // Create a job to track progress
        const jobId = downloadManager.createJob(station_id, safeTitle);

        // Run recording in background
        // recordRadiko returns a Promise.
        recordRadiko(station_id, duration, title, undefined, start_time, false, (progress) => {
            downloadManager.updateProgress(jobId, progress);
        })
            .then(() => {
                console.log('Manual download completed');
                downloadManager.completeJob(jobId);
            })
            .catch(err => {
                console.error('Manual download failed', err);
                downloadManager.failJob(jobId, err.message);
            });

        return NextResponse.json({ success: true, message: 'Download started in background', jobId });

    } catch (error) {
        console.error('Manual download error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
