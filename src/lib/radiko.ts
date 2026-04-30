import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { format, parse } from 'date-fns';
import { logger } from '@/lib/logger';

export interface RadikoAuth {
    authtoken: string;
    area_id: string;
    radiko_session?: string;
}

export interface Program {
    title: string;
    start_time: string;
    end_time: string;
    display_time: string;
    station_id: string;
    performer: string;
    description: string;
    status: 'future' | 'past' | 'present';
}

interface RadikoProg {
    '@_ft': string;
    '@_dur': string;
    title: string;
    pfm: string;
    desc: string;
}

export class RadikoClient {
    private authToken: string | null = null;
    private areaId: string | null = null;
    private radikoSession: string | null = null;
    public areaFree: boolean = false;
    private parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({ ignoreAttributes: false });
    }

    /**
     * Radikoの認証トークンを取得する
     */
    async getAuthToken(forceRefresh: boolean = false): Promise<RadikoAuth> {
        if (!forceRefresh && this.authToken && this.areaId) {
            return { 
                authtoken: this.authToken, 
                area_id: this.areaId,
                radiko_session: this.radikoSession || undefined
            };
        }

        const mail = process.env.RADIKO_MAIL;
        const password = process.env.RADIKO_PASSWORD;

        let radikoSession: string | null = null;

        // 1. プレミアムログイン
        if (mail && password) {
            try {
                logger.info('radikoプレミアムログインを試行します...');
                const loginRes = await fetch('https://radiko.jp/v4/api/member/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ mail, pass: password })
                });

                if (loginRes.ok) {
                    const data = await loginRes.json();
                    if (data.radiko_session) {
                        radikoSession = data.radiko_session;
                        this.radikoSession = radikoSession;
                        this.areaFree = data.areafree == 1;
                        logger.info(`radikoプレミアムログイン成功。AreaFree: ${this.areaFree}`);
                    }
                }
            } catch (e) {
                logger.error({ err: e }, 'radikoプレミアムログインエラー');
            }
        }

        // 2. Auth1
        const auth1Res = await fetch('https://radiko.jp/v2/api/auth1', {
            headers: {
                'X-Radiko-App': 'pc_html5',
                'X-Radiko-App-Version': '0.0.1',
                'X-Radiko-Device': 'pc',
                'X-Radiko-User': 'dummy_user',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!auth1Res.ok) throw new Error('Auth1失敗');

        const token = auth1Res.headers.get('x-radiko-authtoken');
        const keyLength = parseInt(auth1Res.headers.get('x-radiko-keylength') || '0');
        const keyOffset = parseInt(auth1Res.headers.get('x-radiko-keyoffset') || '0');

        if (!token || !keyLength) throw new Error('Auth1レスポンス不正');

        const partialKey = this.generatePartialKey(keyLength, keyOffset);

        // 3. Auth2
        const auth2Url = new URL('https://radiko.jp/v2/api/auth2');
        if (radikoSession) auth2Url.searchParams.set('radiko_session', radikoSession);

        const auth2Res = await fetch(auth2Url.toString(), {
            method: 'GET',
            headers: {
                'X-Radiko-Device': 'pc',
                'X-Radiko-User': 'dummy_user',
                'X-Radiko-AuthToken': token,
                'X-Radiko-PartialKey': partialKey,
                ...(radikoSession ? { 'Cookie': `radiko_session=${radikoSession}` } : {})
            }
        });

        if (!auth2Res.ok) throw new Error('Auth2失敗');

        const bodyText = await auth2Res.text();
        const areaId = bodyText.split(',')[0];

        this.authToken = token;
        this.areaId = areaId;

        return { 
            authtoken: token, 
            area_id: areaId,
            radiko_session: radikoSession || undefined
        };
    }

    private generatePartialKey(length: number, offset: number): string {
        const fullKey = 'bcd151073c03b352e1ef2fd66c32209da9ca0afa';
        const partialKey = fullKey.substring(offset, offset + length);
        return Buffer.from(partialKey).toString('base64');
    }

    private async fetchStationUrls(stationId: string): Promise<any[]> {
        await this.getAuthToken();
        const url = `https://radiko.jp/v3/station/stream/pc_html5/${stationId}.xml`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`XML取得失敗: ${res.status}`);
        const xml = await res.text();
        const jsonObj = this.parser.parse(xml);
        return Array.isArray(jsonObj.urls.url) ? jsonObj.urls.url : [jsonObj.urls.url];
    }

    async getLiveStreamUrl(stationId: string): Promise<string> {
        const urls = await this.fetchStationUrls(stationId);
        const areaFreeParam = this.areaFree ? '1' : '0';
        const matches = urls.filter(u => u['@_timefree'] === '0' && u['@_areafree'] === areaFreeParam);

        if (matches.length > 0) {
            matches.sort((a, b) => {
                const isAGood = typeof a.playlist_create_url === 'string' && a.playlist_create_url.includes('smartstream');
                const isBGood = typeof b.playlist_create_url === 'string' && b.playlist_create_url.includes('smartstream');
                if (isAGood && !isBGood) return -1;
                if (!isAGood && isBGood) return 1;
                return 0;
            });
            return matches[0].playlist_create_url;
        }
        throw new Error('ライブストリームURLが見つかりませんでした');
    }

    /** Alias for getLiveStreamUrl */
    async getLiveStreamBaseUrl(stationId: string): Promise<string> {
        return this.getLiveStreamUrl(stationId);
    }

    async getTimeFreeStreamUrl(stationId: string): Promise<string> {
        const urls = await this.fetchStationUrls(stationId);
        const areaFreeParam = this.areaFree ? '1' : '0';
        const matches = urls.filter(u => u['@_timefree'] === '1' && u['@_areafree'] === areaFreeParam);
        if (matches.length > 0) return matches[0].playlist_create_url;
        throw new Error('タイムフリーURLが見つかりませんでした');
    }

    /** Alias for getTimeFreeStreamUrl */
    async getStreamBaseUrl(stationId: string): Promise<string> {
        return this.getTimeFreeStreamUrl(stationId);
    }

    async getProgramSchedule(stationId: string, date: string): Promise<Program[]> {
        const auth = await this.getAuthToken();
        const url = `https://radiko.jp/v3/program/station/date/${date}/${stationId}.xml`;
        const res = await fetch(url, { headers: { 'X-Radiko-AuthToken': auth.authtoken } });
        if (!res.ok) return [];

        const xml = await res.text();
        const jsonObj = this.parser.parse(xml);
        const station = jsonObj.radiko?.stations?.station;
        if (!station) return [];

        const progs = (station.scd?.progs?.prog || []) as RadikoProg[];
        const progArray = Array.isArray(progs) ? progs : [progs];

        const programs: Program[] = [];
        for (const prog of progArray) {
            const ft = prog['@_ft'];
            const dur = prog['@_dur'] || '0';
            if (!ft) continue;

            const startObj = parse(ft, 'yyyyMMddHHmmss', new Date());
            let displayHours = startObj.getHours();
            if (ft.substring(0, 8) > date) displayHours += 24;

            const endObj = new Date(startObj.getTime() + parseInt(dur, 10) * 1000);

            programs.push({
                title: this.sanitizeString(prog.title),
                start_time: format(startObj, 'yyyy-MM-dd HH:mm:ss'),
                end_time: format(endObj, 'yyyy-MM-dd HH:mm:ss'),
                display_time: `${String(displayHours).padStart(2, '0')}:${String(startObj.getMinutes()).padStart(2, '0')}`,
                station_id: stationId,
                performer: this.sanitizeString(prog.pfm),
                description: this.sanitizeString(prog.desc),
                status: 'future'
            });
        }
        return programs;
    }

    private sanitizeString(val: unknown): string {
        if (!val) return '';
        if (typeof val === 'string') return val.trim();
        if (typeof val === 'object' && val !== null && '#text' in val) {
            return String((val as any)['#text']).trim();
        }
        return String(val).trim();
    }

    async getStations(): Promise<{ id: string, name: string }[]> {
        const url = 'https://radiko.jp/v3/station/region/full.xml';
        const res = await fetch(url);
        if (!res.ok) throw new Error('放送局リスト取得失敗');
        const xml = await res.text();
        const jsonObj = this.parser.parse(xml);
        const regionNodes = Array.isArray(jsonObj.region?.stations) ? jsonObj.region.stations : [jsonObj.region?.stations];
        const stations: { id: string, name: string }[] = [];
        for (const region of regionNodes) {
            const stationNodes = Array.isArray(region.station) ? region.station : [region.station];
            for (const s of stationNodes) {
                if (s && s.id && s.name) {
                    stations.push({ id: String(s.id), name: String(s.name) });
                }
            }
        }
        return stations;
    }

    /**
     * キーワードで番組を検索する
     */
    async search(keyword: string, filter: 'future' | 'past' | 'all' = 'all'): Promise<Program[]> {
        const auth = await this.getAuthToken();
        let url = `https://radiko.jp/v3/api/program/search?key=${encodeURIComponent(keyword)}`;
        if (!this.areaFree) {
            url += `&area_id=${auth.area_id}`;
        }
        if (filter !== 'all') {
            url += `&filter=${filter}`;
        }
        
        const res = await fetch(url, {
            headers: {
                'X-Radiko-AuthToken': auth.authtoken
            }
        });
        if (!res.ok) {
            logger.error(`Radiko search failed: ${res.status} ${res.statusText}`);
            return [];
        }

        const data = await res.json();
        const progs = data.data;
        if (!progs || !Array.isArray(progs)) return [];

        const programs: Program[] = [];

        for (const prog of progs) {
            programs.push({
                title: this.sanitizeString(prog.title),
                start_time: prog.start_time, // yyyy-MM-dd HH:mm:ss 形式でそのまま入っている
                end_time: prog.end_time,
                display_time: prog.start_time ? prog.start_time.substring(11, 16) : '',
                station_id: prog.station_id || '',
                performer: this.sanitizeString(prog.performer),
                description: this.sanitizeString(prog.info || prog.description),
                status: (prog.status as any) || 'future'
            });
        }

        return programs;
    }
}
