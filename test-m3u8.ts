import { RadikoClient } from './src/lib/radiko';

async function main() {
    const client = new RadikoClient();
    const auth = await client.getAuthToken();
    const stationId = 'FMT';
    const url = await client.getLiveStreamBaseUrl(stationId);

    const liveUrl = new URL(url);
    liveUrl.searchParams.set('station_id', stationId);
    liveUrl.searchParams.set('l', '15');
    liveUrl.searchParams.set('type', 'c');

    const headers = {
        'X-Radiko-Authtoken': auth.authtoken,
        'X-Radiko-AreaId': auth.area_id,
        'User-Agent': 'Mozilla/5.0'
    };

    const res = await fetch(liveUrl.toString(), { headers });
    const m3u8 = await res.text();

    const lines = m3u8.split('\n');
    let chunklistUrl = '';
    for (const line of lines) {
        if (line.startsWith('http')) {
            chunklistUrl = line;
            break;
        }
    }

    if (chunklistUrl) {
        const chunkRes = await fetch(chunklistUrl, { headers });
        console.log(await chunkRes.text());
    } else {
        console.log("No chunklist URL found:", m3u8);
    }
}

main().catch(console.error);
