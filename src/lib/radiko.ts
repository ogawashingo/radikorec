
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
        // 検索APIは認証不要で、area_idを省略すると全エリアを検索します
        // const { authtoken, area_id } = await this.getAuthToken();

        // キーワードをエンコード
        const encodedKey = encodeURIComponent(keyword);

        // API URL構築 (area_idを指定しないことで全国検索になる)
        // 元のURL: ...&area_id=${area_id}
        const url = `http://radiko.jp/v3/api/program/search?key=${encodedKey}&filter=future`;

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
