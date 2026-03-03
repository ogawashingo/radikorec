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

    const res = await fetch(liveUrl.toString(), {
        headers: {
            'X-Radiko-Authtoken': auth.authtoken,
            'X-Radiko-AreaId': auth.area_id,
            'User-Agent': 'Mozilla/5.0',
            'X-Radiko-App': 'pc_html5',
            'X-Radiko-App-Version': '0.0.1',
            'X-Radiko-Device': 'pc',
            'X-Radiko-User': 'dummy_user'
        }
    });

    console.log("Status:", res.status);
    console.log("Headers:");
    res.headers.forEach((v, k) => console.log(k, ":", v));

    const body = await res.text();
    console.log("Body starts with:", body.substring(0, 100));
}

main().catch(console.error);
