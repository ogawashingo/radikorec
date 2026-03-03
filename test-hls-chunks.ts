import { RadikoClient } from './src/lib/radiko';

async function main() {
    const client = new RadikoClient();
    const auth = await client.getAuthToken();
    const stationId = 'FMT'; // TOKYO FM
    const url = await client.getLiveStreamBaseUrl(stationId);

    const liveUrl = new URL(url);
    liveUrl.searchParams.set('station_id', stationId);
    liveUrl.searchParams.set('l', '15');
    liveUrl.searchParams.set('type', 'c');

    console.log("Fetching liveUrl:", liveUrl.toString());
    const res = await fetch(liveUrl.toString(), {
        headers: {
            'X-Radiko-Authtoken': auth.authtoken,
            'X-Radiko-AreaId': auth.area_id
        }
    });

    const m3u8 = await res.text();
    console.log("Variant M3U8 length:", m3u8.length);

    // Find stream url
    const lines = m3u8.split('\n');
    let chunklistUrl = '';
    for (const line of lines) {
        if (line.startsWith('http')) {
            chunklistUrl = line;
            break;
        }
    }

    if (chunklistUrl) {
        console.log("Fetching Chunklist:", chunklistUrl);
        const chunkRes = await fetch(chunklistUrl, {
            headers: {
                'X-Radiko-Authtoken': auth.authtoken,
                'X-Radiko-AreaId': auth.area_id
            }
        });
        const chunkText = await chunkRes.text();
        console.log("Chunklist M3U8:");

        // Print first 20 lines to check for EXT-X-PROGRAM-DATE-TIME
        console.log(chunkText.split('\n').slice(0, 20).join('\n'));
    }
}

main().catch(console.error);
