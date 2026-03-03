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

    console.log("URL:", liveUrl.toString());

    const res = await fetch(liveUrl.toString(), {
        headers: {
            'X-Radiko-Authtoken': auth.authtoken,
            'X-Radiko-AreaId': auth.area_id
        }
    });

    const text = await res.text();
    console.log("M3U8:");
    console.log(text);
}

main().catch(console.error);
