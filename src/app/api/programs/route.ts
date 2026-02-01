import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('station');
    const date = searchParams.get('date'); // YYYYMMDD

    if (!stationId || !date) {
        return NextResponse.json({ error: 'Missing station or date' }, { status: 400 });
    }

    try {
        const url = `https://radiko.jp/v3/program/station/date/${date}/${stationId}.xml`;
        const { stdout: xmlContent } = await execAsync(`curl -s "${url}"`);

        // Use a single xmllint call to get all <prog> elements
        const { stdout: progsXml } = await execAsync(`echo '${xmlContent.replace(/'/g, "'\\''")}' | xmllint --xpath "//prog" -`);

        // Split by </prog> to get individual program blocks
        const blocks = progsXml.split('</prog>').filter(b => b.trim());

        const programs = blocks.map(block => {
            const titleMatch = block.match(/<title>(.*?)<\/title>/);
            const pfmMatch = block.match(/<pfm>(.*?)<\/pfm>/);
            const ftMatch = block.match(/ft="(.*?)"/);
            const durMatch = block.match(/dur="(.*?)"/);

            const ft = ftMatch ? ftMatch[1] : '';
            const dur = durMatch ? durMatch[1] : '0';

            // Format time from YYYYMMDDHHMMSS
            const progDateStr = ft.substring(0, 8);
            const hours = parseInt(ft.substring(8, 10));
            const minutes = ft.substring(10, 12);

            let displayHours = hours;
            // If the program starts on the next day relative to requested date, add 24 to hours
            if (progDateStr > date) {
                displayHours += 24;
            }

            const timeStr = `${ft.substring(8, 10)}:${minutes}`;
            const displayTime = `${String(displayHours).padStart(2, '0')}:${minutes}`;

            return {
                title: titleMatch ? decodeXml(titleMatch[1]) : '無題',
                start: ft,
                time: timeStr, // Real calendar time
                displayTime,   // 24h+ broadcast day time
                duration: Math.floor(parseInt(dur, 10) / 60),
                performer: pfmMatch ? decodeXml(pfmMatch[1]) : ''
            };
        });

        return NextResponse.json(programs);

    } catch (error) {
        console.error('Failed to fetch programs:', error);
        return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 });
    }
}

function decodeXml(str: string) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
}
