import { XMLParser } from 'fast-xml-parser';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';

const AUTH_KEY = 'bcd151073c03b352e1ef2fd66c32209da9ca0afa';

interface RadikoAuthResult {
    authtoken: string;
    area_id: string;
}

interface SearchResult {
    meta: Record<string, unknown>;
    data: Program[];
}

interface StreamUrl {
    '@_timefree'?: string;
    '@_areafree'?: string;
    playlist_create_url?: string;
}

interface RadikoProg {
    '@_ft'?: string;
    '@_dur'?: string;
    title?: string | { '#text': string };
    pfm?: string | { '#text': string };
    desc?: string | { '#text': string };
}

export interface Program {
    title: string;
    start_time: string; // 例: "2024-01-01 12:00:00"
    end_time: string;
    station_id: string;
    performer: string;
    description: string;
    display_time?: string; // 例: "25:00"
    status: string; // "past" (過去), "now" (現在), "future" (未来)
}

export class RadikoClient {
    private authToken: string | null = null;
    private areaId: string | null = null;
    private areaFree: boolean = false;
    private tokenExpiresAt: number = 0;
    private parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_"
    });

    async getAuthToken(forceRefresh = false): Promise<RadikoAuthResult> {
        if (!forceRefresh && this.authToken && this.areaId && Date.now() < this.tokenExpiresAt) {
            return { authtoken: this.authToken, area_id: this.areaId };
        }

        let radikoSession = '';
        const mail = process.env.RADIKO_MAIL;
        const password = process.env.RADIKO_PASSWORD;

        // 1. プレミアムログイン（設定されている場合）
        if (mail && password) {
            try {
                logger.info('Radikoプレミアムログインを試行します...');
                const loginRes = await fetch('https://radiko.jp/v4/api/member/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ mail, pass: password })
                });

                if (loginRes.ok) {
                    try {
                        const data = await loginRes.json();
                        radikoSession = data.radiko_session;
                        // 文字列の "1" か 数値の 1 かに対応するため緩い比較を使用
                        this.areaFree = data.areafree == 1;
                        logger.info(`Radikoプレミアムログイン成功。AreaFree: ${this.areaFree}`);
                    } catch (parseErr: unknown) {
                        // Node.js 20+ における閉じたストリームの特定エラー処理
                        if (parseErr instanceof Error && parseErr.message.includes('ReadableStream is already closed')) {
                            logger.warn('ログインレスポンス解析中の ReadableStream エラーを抑制しました (Node.js 既知の問題)');
                        } else {
                            throw parseErr;
                        }
                    }
                } else {
                    logger.error({ error: await loginRes.text() }, 'Radikoプレミアムログインに失敗しました');
                }
            } catch (e) {
                logger.error({ err: e }, 'Radikoプレミアムログインエラーが発生しました');
            }
        }

        // 2. Auth1（認証ステップ1）
        const auth1Res = await fetch('https://radiko.jp/v2/api/auth1', {
            headers: {
                'X-Radiko-App': 'pc_html5',
                'X-Radiko-App-Version': '0.0.1',
                'X-Radiko-Device': 'pc',
                'X-Radiko-User': 'dummy_user',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!auth1Res.ok) throw new Error('Auth1（認証ステップ1）に失敗しました');

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
            throw new Error(`Auth2（認証ステップ2）に失敗しました: ${auth2Res.status} ${errText}`);
        }

        const bodyText = await auth2Res.text();
        // レスポンスボディに area_id が含まれる: JP13,Tokyo,tokyo,...
        const areaId = bodyText.split(',')[0];

        this.authToken = token;
        this.areaId = areaId;
        // 有効期限を 24時間後 に設定
        this.tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;

        logger.info({ areaId }, 'Radiko認証成功');

        return { authtoken: token, area_id: areaId };
    }

    async search(keyword: string, filter: 'future' | 'past' | 'now' | undefined = 'future'): Promise<Program[]> {
        // 検索APIは認証不要で、area_idを省略すると全エリアを検索します
        // const { authtoken, area_id } = await this.getAuthToken();

        // キーワードをエンコード
        const encodedKey = encodeURIComponent(keyword);

        // API URL構築 (area_idを指定しないことで全国検索になる)
        // filter引数を使用（デフォルトはfuture）
        let url = `http://radiko.jp/v3/api/program/search?key=${encodedKey}`;
        if (filter) {
            url += `&filter=${filter}`;
        }

        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(`検索に失敗しました: ${res.status}`);
        }

        const data: SearchResult = await res.json();
        // Radikoの検索APIは start_time_s を直接返す (例: "2500")
        // フロントエンド向けに display_time へマッピングする
        const programs = data.data.map(p => {
            const startTimeS = (p as unknown as Record<string, unknown>).start_time_s as string | undefined;
            if (startTimeS) {
                const hour = startTimeS.substring(0, 2);
                const min = startTimeS.substring(2, 4);
                p.display_time = `${hour}:${min}`;
            }
            return p;
        });
        return programs;
    }

    private async fetchStationUrls(stationId: string): Promise<StreamUrl[]> {
        const attemptFetch = async (forceRefresh: boolean) => {
            await this.getAuthToken(forceRefresh);
            const url = `https://radiko.jp/v3/station/stream/pc_html5/${stationId}.xml`;
            return await fetch(url);
        };

        let res = await attemptFetch(false);

        // 認証エラー（不正なトークンなど）の場合はトークンを再取得してリトライ
        if (res.status === 401 || res.status === 403) {
            logger.warn({ stationId, status: res.status }, 'Auth token expired or invalid, refreshing...');
            res = await attemptFetch(true);
        }

        if (!res.ok) throw new Error(`XMLの取得に失敗しました: ${res.status}`);

        const xml = await res.text();
        const jsonObj = this.parser.parse(xml);

        // jsonObj.urls.url は配列の場合とオブジェクトの場合がある
        const urls = Array.isArray(jsonObj.urls?.url) ? jsonObj.urls.url : [jsonObj.urls?.url].filter(Boolean);
        return urls as StreamUrl[];
    }

    async getStreamBaseUrl(stationId: string): Promise<string> {
        // プレミアムステータスを取得するために認証を確実に行う
        const urls = await this.fetchStationUrls(stationId);
        const areaFreeParam = this.areaFree ? '1' : '0';

        // timefree="1" かつ areafree=areaFreeParam のものを探す
        const match = urls.find(u => u['@_timefree'] === '1' && u['@_areafree'] === areaFreeParam);
        if (match?.playlist_create_url && typeof match.playlist_create_url === 'string') return match.playlist_create_url;

        // フォールバック: timefree="1" なら何でも
        const fallback = urls.find(u => u['@_timefree'] === '1');
        if (fallback?.playlist_create_url && typeof fallback.playlist_create_url === 'string') {
            logger.warn({ stationId }, '厳密なエリアフリー一致に失敗しました。任意のタイムフリーURLにフォールバックします');
            return fallback.playlist_create_url;
        }

        throw new Error(`放送局 ${stationId} のストリームURLが見つかりませんでした (AreaFree: ${areaFreeParam})`);
    }

    async getLiveStreamBaseUrl(stationId: string): Promise<string> {
        const urls = await this.fetchStationUrls(stationId);
        const areaFreeParam = this.areaFree ? '1' : '0';

        const matches = urls.filter(u => u['@_timefree'] === '0' && u['@_areafree'] === areaFreeParam);

        if (matches.length > 0) {
            // 安定している dr-wowza ドメインなどを優先的に選択
            matches.sort((a, b) => {
                const isAGood = typeof a.playlist_create_url === 'string' && a.playlist_create_url.includes('dr-wowza');
                const isBGood = typeof b.playlist_create_url === 'string' && b.playlist_create_url.includes('dr-wowza');
                if (isAGood && !isBGood) return -1;
                if (!isAGood && isBGood) return 1;
                return 0;
            });

            const bestUrl = matches[0].playlist_create_url;
            if (typeof bestUrl === 'string') {
                logger.info({ stationId, url: bestUrl }, 'ライブストリームURLを選択しました');
                return bestUrl;
            }
        }

        throw new Error(`放送局 ${stationId} のライブストリームURLが見つかりませんでした (AreaFree: ${areaFreeParam})`);
    }

    async getProgramSchedule(stationId: string, date: string): Promise<Program[]> {
        // 番組表APIは認証なしでも動作するが、完全な情報を得るために認証を含めることがある。
        // 現在は認証ヘッダを送っていないため通常は不要だが、将来的に拡張された際のためにリトライの枠組みを用意しておく。
        const url = `https://radiko.jp/v3/program/station/date/${date}/${stationId}.xml`;
        let res = await fetch(url);

        if (!res.ok && (res.status === 401 || res.status === 403)) {
            // もし将来的にAuthTokenをヘッダに付与した際に期限切れとなった場合のリトライ
            await this.getAuthToken(true);
            res = await fetch(url);
        }

        if (!res.ok) {
            throw new Error(`番組リストの取得に失敗しました: ${res.status}`);
        }

        const xml = await res.text();
        const jsonObj = this.parser.parse(xml);

        const programs: Program[] = [];

        // XMLの構造: radiko > stations > station > scd > progs > prog
        const station = jsonObj.radiko?.stations?.station;
        if (!station) return [];

        const progs = Array.isArray(station.scd?.progs?.prog)
            ? station.scd.progs.prog as RadikoProg[]
            : ([station.scd?.progs?.prog].filter(Boolean) as RadikoProg[]);

        for (const prog of progs) {
            const ft = prog['@_ft'];
            const dur = prog['@_dur'] || '0';

            if (!ft) continue;

            // 時間フォーマット YYYYMMDDHHMMSS からパース
            const progDateStr = ft.substring(0, 8);
            const hours = parseInt(ft.substring(8, 10));
            const minutes = ft.substring(10, 12);

            let displayHours = hours;
            // リクエストされた日付より翌日の場合、24時間表記に加算 (25:00等)
            if (progDateStr > date) {
                displayHours += 24;
            }

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

            programs.push({
                title: this.sanitizeString(prog.title),
                start_time: this.formatDateForProgram(startObj),
                end_time: this.formatDateForProgram(endObj),
                display_time: `${String(displayHours).padStart(2, '0')}:${minutes}`,
                station_id: stationId,
                performer: this.sanitizeString(prog.pfm),
                description: this.sanitizeString(prog.desc),
                status: 'future'
            });
        }

        return programs;
    }

    private formatDateForProgram(d: Date): string {
        return format(d, 'yyyy-MM-dd HH:mm:ss');
    }

    private sanitizeString(val: unknown): string {
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') return val.trim();
        // fast-xml-parserは子要素が混在している場合にコンテンツをラップする可能性があるが、通常は単なる文字列コンテンツ
        if (typeof val === 'object' && val !== null && '#text' in val) {
            return String((val as Record<string, unknown>)['#text']).trim();
        }
        return String(val).trim();
    }

    async getStations(): Promise<{ id: string, name: string }[]> {
        const url = 'https://radiko.jp/v3/station/region/full.xml';
        const res = await fetch(url);
        if (!res.ok) throw new Error('放送局リストの取得に失敗しました');

        const xml = await res.text();
        const jsonObj = this.parser.parse(xml);

        // XMLの構造: region > stations[] > station[]
        const regionNodes = Array.isArray(jsonObj.region?.stations)
            ? jsonObj.region.stations
            : [jsonObj.region?.stations].filter(Boolean);

        const stations: { id: string, name: string }[] = [];

        for (const region of regionNodes) {
            const stationNodes = Array.isArray(region.station)
                ? region.station
                : [region.station].filter(Boolean);

            for (const s of stationNodes) {
                stations.push({
                    id: String(s.id),
                    name: String(s.name)
                });
            }
        }

        return stations;
    }
}
