import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
    try {
        const { stdout } = await execAsync('./rec_radiko_ts.sh -l');

        // 出力フォーマットチェック: 'ID:Name:Number' (例: 'TBS:TBSラジオ:90')
        // 改行で分割し、次に':'で分割
        const stations = stdout
            .trim()
            .split('\n')
            .map(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    return {
                        id: parts[0].trim(),
                        name: parts[1].trim()
                    };
                }
                return null;
            })
            .filter((s): s is { id: string, name: string } => s !== null);

        if (stations.length > 0) {
            return NextResponse.json(stations);
        }

        throw new Error('No stations found');
    } catch (error) {
        console.error('Failed to fetch stations list:', error);

        // スクリプトが失敗したり空を返した場合は静的リストにフォールバック
        const FALLBACK_STATIONS = [
            { id: 'TBS', name: 'TBSラジオ' },
            { id: 'QRR', name: '文化放送' },
            { id: 'LFR', name: 'ニッポン放送' },
            { id: 'RN1', name: 'ラジオNIKKEI第1' },
            { id: 'RN2', name: 'ラジオNIKKEI第2' },
            { id: 'INT', name: 'InterFM897' },
            { id: 'FMT', name: 'TOKYO FM' },
            { id: 'FMJ', name: 'J-WAVE' },
            { id: 'JORF', name: 'ラジオ日本' },
            { id: 'BAYFM78', name: 'bayfm78' },
            { id: 'NACK5', name: 'NACK5' },
            { id: 'YFM', name: 'ＦＭヨコハマ' },
            { id: 'JOAK', name: 'NHKラジオ第1（東京）' },
            { id: 'JOAK-FM', name: 'NHK-FM（東京）' },
        ];
        return NextResponse.json(FALLBACK_STATIONS);
    }
}
