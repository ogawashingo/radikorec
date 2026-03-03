import { RadikoClient } from './src/lib/radiko';
import { execSync } from 'child_process';

async function main() {
    const client = new RadikoClient();
    const auth = await client.getAuthToken();
    const stationId = 'FMT';
    const url = await client.getLiveStreamBaseUrl(stationId);

    const liveUrl = new URL(url);
    liveUrl.searchParams.set('station_id', stationId);
    liveUrl.searchParams.set('l', '15');
    liveUrl.searchParams.set('type', 'c');

    console.log("URL:", liveUrl.toString());
    const cmd = `curl -s -v -H "X-Radiko-Authtoken: ${auth.authtoken}" -H "X-Radiko-AreaId: ${auth.area_id}" -H "User-Agent: Mozilla/5.0" "${liveUrl.toString()}"`;
    try {
        const out = execSync(cmd).toString();
        // search for chunklist url
        const lines = out.split('\n');
        let m3u8Url = '';
        for (const line of lines) {
            if (line.startsWith('http')) {
                m3u8Url = line.trim();
                break;
            }
        }
        if (m3u8Url) {
            console.log("Found chunklist:", m3u8Url);
            const cmd2 = `curl -s -v -H "X-Radiko-Authtoken: ${auth.authtoken}" -H "X-Radiko-AreaId: ${auth.area_id}" -H "User-Agent: Mozilla/5.0" "${m3u8Url}"`;
            const out2 = execSync(cmd2).toString();
            console.log("Chunklist output:", out2.split('\n').slice(0, 10));
        } else {
            console.log("No chunklist inside:", out);
        }
    } catch (e) {
        console.error("CURL error");
    }
}

main().catch(console.error);
