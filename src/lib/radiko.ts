
const AUTH_KEY = 'bcd151073c03b352e1ef2fd66c32209da9ca0afa';

interface RadikoAuthResult {
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
    private areaFree: boolean = false;

    async getAuthToken(): Promise<RadikoAuthResult> {
        if (this.authToken && this.areaId) {
            return { authtoken: this.authToken, area_id: this.areaId };
        }

        let radikoSession = '';
        const mail = process.env.RADIKO_MAIL;
        const password = process.env.RADIKO_PASSWORD;

        // 1. プレミアムログイン（設定されている場合）
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
                    this.areaFree = data.areafree === 1;
                    console.log(`Radiko Premium login successful. AreaFree: ${this.areaFree}`);
                } else {
                    console.error('Radiko Premium login failed', await loginRes.text());
                }
            } catch (e) {
                console.error('Radiko Premium login error', e);
            }
        }

        // 2. Auth1（認証ステップ1）
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

        // 3. Partial Key（部分的キー）の計算
        const partialKey = Buffer.from(AUTH_KEY).slice(offset, offset + length).toString('base64');

        // 4. Auth2（認証ステップ2）
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
        // レスポンスボディに area_id が含まれる: JP13,Tokyo,tokyo,...
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
        const url = `http://radiko.jp/v3/api/program/search?key=${encodedKey}&filter=future`;

        const res = await fetch(url, {
            headers: {
                // 'X-Radiko-AuthToken': authtoken // ここでの認証トークンは不要
            }
        });

        if (!res.ok) {
            throw new Error(`Search failed: ${res.status}`);
        }

        const data: SearchResult = await res.json();
        return data.data;
    }

    /**
     * 放送局のHLSストリームベースURLを取得
     */
    async getStreamBaseUrl(stationId: string): Promise<string> {
        // プレミアムステータスを取得するために認証を確実に行う
        await this.getAuthToken();

        const areaFreeParam = this.areaFree ? '1' : '0';
        const url = `https://radiko.jp/v3/station/stream/pc_html5/${stationId}.xml`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`XMLの取得に失敗しました: ${res.status}`);

        const xml = await res.text();

        // 簡易的な正規表現によるXMLパース
        // ターゲット: <url timefree="1" areafree="0|1">を検索
        // 属性の順序に依存しないRegexを使用 (areafree / timefree のどちらが先でもOK)

        // パターンA: areafreeが先 (例: <url areafree="0" timefree="1">)
        const regexA = new RegExp(`<url[^>]*areafree="${areaFreeParam}"[^>]*timefree="1"[^>]*>[\\s\\S]*?<playlist_create_url>(.*?)<\\/playlist_create_url>`, 'i');
        const matchA = xml.match(regexA);
        if (matchA && matchA[1]) return matchA[1];

        // パターンB: timefreeが先 (例: <url timefree="1" areafree="0">)
        const regexB = new RegExp(`<url[^>]*timefree="1"[^>]*areafree="${areaFreeParam}"[^>]*>[\\s\\S]*?<playlist_create_url>(.*?)<\\/playlist_create_url>`, 'i');
        const matchB = xml.match(regexB);
        if (matchB && matchB[1]) return matchB[1];

        // フォールバック: 厳密なマッチが失敗した場合、timefree="1" のURLなら何でも取得を試みる
        const fallbackRegex = /<url\s+timefree="1"[\s\S]*?<playlist_create_url>(.*?)<\/playlist_create_url>/i;
        const fallbackMatch = xml.match(fallbackRegex);
        if (fallbackMatch && fallbackMatch[1]) {
            console.warn(`${stationId} の厳密な areafree マッチに失敗しました。任意の timefree URL にフォールバックします。`);
            return fallbackMatch[1];
        }

        throw new Error(`放送局 ${stationId} のストリームURLが見つかりませんでした (AreaFree: ${areaFreeParam})`);
    }

    async getLiveStreamBaseUrl(stationId: string): Promise<string> {
        await this.getAuthToken();

        const areaFreeParam = this.areaFree ? '1' : '0';
        const url = `https://radiko.jp/v3/station/stream/pc_html5/${stationId}.xml`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`XMLの取得に失敗しました: ${res.status}`);

        const xml = await res.text();

        // ライブ放送用パターン: timefree="0" (または timefree属性なしだが、通常は "0" がある)

        // パターンA: areafreeが先
        const regexA = new RegExp(`<url[^>]*areafree="${areaFreeParam}"[^>]*timefree="0"[^>]*>[\\s\\S]*?<playlist_create_url>(.*?)<\\/playlist_create_url>`, 'i');
        const matchA = xml.match(regexA);
        if (matchA && matchA[1]) return matchA[1];

        // パターンB: timefreeが先
        const regexB = new RegExp(`<url[^>]*timefree="0"[^>]*areafree="${areaFreeParam}"[^>]*>[\\s\\S]*?<playlist_create_url>(.*?)<\\/playlist_create_url>`, 'i');
        const matchB = xml.match(regexB);
        if (matchB && matchB[1]) return matchB[1];

        throw new Error(`放送局 ${stationId} のライブストリームURLが見つかりませんでした (AreaFree: ${areaFreeParam})`);
    }

    async getStations(): Promise<{ id: string, name: string }[]> {
        const url = 'https://radiko.jp/v3/station/region/full.xml';
        const res = await fetch(url);
        if (!res.ok) throw new Error('放送局リストの取得に失敗しました');

        const xml = await res.text();
        const stations: { id: string, name: string }[] = [];

        // <station> タグで分割
        const parts = xml.split('<station>');
        for (const part of parts) {
            // ID抽出
            const idMatch = part.match(/<id>(.*?)<\/id>/);
            const nameMatch = part.match(/<name>(.*?)<\/name>/);

            if (idMatch && nameMatch) {
                stations.push({
                    id: idMatch[1],
                    name: nameMatch[1]
                });
            }
        }

        return stations;
    }
}
