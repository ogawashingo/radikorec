
const AUTH_KEY = 'bcd151073c03b352e1ef2fd66c32209da9ca0afa';

interface RadikoAuthResult {
    authtoken: string;
    area_id: string;
}

interface SearchResult {
    meta: any;
    data: Program[];
}

export interface Program {
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


    async getProgramSchedule(stationId: string, date: string): Promise<Program[]> {
        const url = `https://radiko.jp/v3/program/station/date/${date}/${stationId}.xml`;
        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(`Failed to fetch programs: ${res.status}`);
        }

        const xml = await res.text();
        const programs: Program[] = [];

        // <prog> タグで分割して各番組ブロックを処理
        const blocks = xml.split('</prog>');

        for (const block of blocks) {
            if (!block.trim()) continue;

            const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
            const pfmMatch = block.match(/<pfm>([\s\S]*?)<\/pfm>/);
            const infoMatch = block.match(/<info>([\s\S]*?)<\/info>/);
            const descMatch = block.match(/<desc>([\s\S]*?)<\/desc>/);
            const ftMatch = block.match(/ft="(.*?)"/);
            const durMatch = block.match(/dur="(.*?)"/);

            if (!ftMatch) continue;

            const ft = ftMatch[1];
            const dur = durMatch ? durMatch[1] : '0';

            // Format time from YYYYMMDDHHMMSS
            const progDateStr = ft.substring(0, 8);
            const hours = parseInt(ft.substring(8, 10));
            const minutes = ft.substring(10, 12);

            let displayHours = hours;
            // リクエストされた日付より翌日の場合、24時間表記に加算 (25:00等)
            if (progDateStr > date) {
                displayHours += 24;
            }

            // const timeStr = `${ft.substring(8, 10)}:${minutes}`;

            // end_time の計算
            // Node.js の日付計算を使用
            const startObj = new Date(
                parseInt(ft.substring(0, 4)),
                parseInt(ft.substring(4, 6)) - 1,
                parseInt(ft.substring(6, 8)),
                parseInt(ft.substring(8, 10)),
                parseInt(ft.substring(10, 12)),
                parseInt(ft.substring(12, 14))
            );
            const durationSec = parseInt(dur, 10);
            const endObj = new Date(startObj.getTime() + durationSec * 1000);

            // end_time format: 2024-01-01 12:00:00 (for compatibility with scanner logic, roughly ISO)
            // Scanner uses: new Date(p.end_time)
            const endTimeStr = endObj.toISOString();

            // Status match (not strictly in XML, but derived)
            // const status = 'future'; // calc if needed

            programs.push({
                title: titleMatch ? this.decodeXml(titleMatch[1]) : '無題',
                // BUT scanner.ts:55 const startTimeDate = new Date(prog.start_time);
                // If start_time is "20240204120000", new Date() might fail in some envs, 
                // check api/programs/route.ts:53 "start: ft" -> It returns raw FT string.
                // Wait, api/programs/route.ts returns object with `start`, `time`, `displayTime`.
                // search() returns `Program[]` which has `start_time`.
                // Let's stick to the Program interface defined at top of file?
                // Interface Program defined line 14: start_time: string; // "2024-01-01 12:00:00"
                // search() API from radiko v3 returns "2024-01-01 12:00:00".
                // This XML returns "20240101120000".
                // We should probably normalize to match search() format if possible, OR
                // update the Caller to handle both.
                // api/programs/route.ts currently returns specific object shape.

                // Re-mapping to match RadikoClient.Program interface roughly, 
                // OR duplicate the specific shape needed by the frontend...
                // RadikoClient.search returns specific shape.
                // Let's implement this method to return what's needed, conforming to Program interface if possible, 
                // or creating a new interface for Schedule.

                // Let's just return what `route.ts` constructed, but cleaner.
                // Actually, let's keep it simple within RadikoClient and let route.ts map it if needed?
                // Or make RadikoClient return the standard `Program` object.

                // Standard Program object:
                // start_time: "2024-01-01 12:00:00"

                start_time: this.formatDateForProgram(startObj),
                end_time: this.formatDateForProgram(endObj),
                station_id: stationId,
                performer: pfmMatch ? this.decodeXml(pfmMatch[1]) : '',
                description: descMatch ? this.decodeXml(descMatch[1]) : '',
                status: 'future' // Simplified
            });
        }

        return programs;
    }

    private formatDateForProgram(d: Date): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        // YYYY-MM-DD HH:mm:ss
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    private decodeXml(str: string): string {
        return str
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
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
