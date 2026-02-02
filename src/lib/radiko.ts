
const AUTH_KEY = 'bcd151073c03b352e1ef2fd66c32209da9ca0afa';

interface RadikoAuthResult { // Renamed from AuthResult
    authtoken: string;
    area_id: string;
}

interface SearchResult {
    meta: any;
    data: Program[];
}

interface Program {
    title: string;
    start_time: string; // "2024-01-01 12:00:00"
    end_time: string;
    station_id: string;
    performer: string;
    description: string;
    status: string; // "past", "now", "future"
}

export class RadikoClient {
    private authToken: string | null = null;
    private areaId: string | null = null;

    async getAuthToken(): Promise<RadikoAuthResult> {
        if (this.authToken && this.areaId) {
            return { authtoken: this.authToken, area_id: this.areaId };
        }

        let radikoSession = '';
        const mail = process.env.RADIKO_MAIL;
        const password = process.env.RADIKO_PASSWORD;

        // 1. Premium Login (if configured)
        if (mail && password) {
            try {
                console.log('Attempting Radiko Premium login...');
                const loginRes = await fetch('https://radiko.jp/v4/api/member/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ mail, pass: password })
                });

                if (loginRes.ok) {
                    const data = await loginRes.json();
                    radikoSession = data.radiko_session;
                    console.log('Radiko Premium login successful');
                } else {
                    console.error('Radiko Premium login failed', await loginRes.text());
                }
            } catch (e) {
                console.error('Radiko Premium login error', e);
            }
        }

        // 2. Auth1
        const auth1Res = await fetch('https://radiko.jp/v2/api/auth1', {
            headers: {
                'X-Radiko-App': 'pc_html5',
                'X-Radiko-App-Version': '0.0.1',
                'X-Radiko-Device': 'pc',
                'X-Radiko-User': 'dummy_user'
            }
        });

        if (!auth1Res.ok) throw new Error('Auth1 failed');

        const token = auth1Res.headers.get('x-radiko-authtoken');
        const offset = parseInt(auth1Res.headers.get('x-radiko-keyoffset') || '0');
        const length = parseInt(auth1Res.headers.get('x-radiko-keylength') || '0');

        if (!token || !length) throw new Error('Invalid Auth1 response');

        // 3. Calculate Partial Key
        const partialKey = Buffer.from(AUTH_KEY).slice(offset, offset + length).toString('base64');

        // 4. Auth2
        const auth2Url = new URL('https://radiko.jp/v2/api/auth2');
        if (radikoSession) {
            auth2Url.searchParams.set('radiko_session', radikoSession);
        }

        const auth2Res = await fetch(auth2Url.toString(), {
            method: 'GET',
            headers: {
                'X-Radiko-Device': 'pc',
                'X-Radiko-User': 'dummy_user',
                'X-Radiko-AuthToken': token,
                'X-Radiko-PartialKey': partialKey
            }
        });

        if (!auth2Res.ok) {
            const errText = await auth2Res.text();
            throw new Error(`Auth2 failed: ${auth2Res.status} ${errText}`);
        }

        const bodyText = await auth2Res.text();
        // Body contains area_id: JP13,Tokyo,tokyo,...
        const areaId = bodyText.split(',')[0];

        this.authToken = token;
        this.areaId = areaId;

        console.log(`Radiko Auth success. Area: ${areaId}`);

        return { authtoken: token, area_id: areaId };
    }

    async search(keyword: string): Promise<Program[]> {
        const { authtoken, area_id } = await this.getAuthToken();

        // Search API
        // Assuming Premium users can search all areas if they are premium?
        // Actually, Radiko Premium account allows listening to all areas.
        // Does search API automatically cover all areas if authenticated with premium session?
        // Based on script logic for areafree=1, it might.
        // But area_id param in search API might restrict it.
        // Let's rely on area_id returned by auth. If premium, area_id is user's area but session allows area-free actions.
        // However, for search, we might need to specify area or use a special "all" area?
        // Documentation is scarce.
        // We will stick to the default behavior: if premium, maybe area_id doesn't matter or covers all.
        // Or maybe premium users have a different area_id?
        // The script just gets area_id.
        // Wait, for premium users, the auth2 returns the area of residence, but the session allows cross-area play.
        // For SEARCH, `http://radiko.jp/v3/api/program/search` takes `area_id`.
        // If I pass my local area_id, does it search globally if I have a session?
        // Probably not. Search might be area-bound.
        // BUT, `radiko.jp` website search allows searching all stations.
        // Let's assume standard behavior for now.

        // Need to encode keyword
        const encodedKey = encodeURIComponent(keyword);

        // Add random delay to be safe (implemented in scanner, but good here too? No, keep it in scanner)

        const url = `http://radiko.jp/v3/api/program/search?key=${encodedKey}&filter=future&area_id=${area_id}`;

        const res = await fetch(url, {
            headers: {
                // 'X-Radiko-AuthToken': authtoken // Curl worked without this
                // 'User-Agent': ... // Curl defaults curl/x.x
            }
        });

        if (!res.ok) {
            throw new Error(`Search failed: ${res.status}`);
        }

        const data: SearchResult = await res.json();
        return data.data;
    }
}
