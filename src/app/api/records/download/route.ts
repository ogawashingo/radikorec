import { NextResponse } from 'next/server';
import { recordRadiko } from '@/lib/recorder';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { station_id, start_time, duration, title } = body;

        if (!station_id || !start_time || !duration) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        console.log(`Manual download requested: ${title} (${station_id})`);

        // Immediate recording (TimeFree usually, unless is_realtime is specified but for "past" it is TimeFree)
        // start_time should be ISO string or compatible
        // isRealtime = false (default)

        // Run recording in background (do not await completion for the response, 
        // BUT user might want to know if it started successfully. 
        // recordRadiko returns a Promise. If we await it, the request will timeout for long programs.
        // So we trigger it and return success.)

        // However, recordRadiko logic currently awaits ffmpeg.
        // We should wrap it in a non-awaiting function or just not await here.

        // But we want to catch immediate startup errors?
        // Let's just fire and forget, logging mainly.

        recordRadiko(station_id, duration, title, undefined, start_time, false)
            .then(() => console.log('Manual download completed'))
            .catch(err => console.error('Manual download failed', err));

        return NextResponse.json({ success: true, message: 'Download started in background' });

    } catch (error) {
        console.error('Manual download error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
