import { NextResponse } from 'next/server';
import { RadikoClient } from '@/lib/radiko';

const client = new RadikoClient();

export async function GET() {
    try {
        const stations = await client.getStations();

        if (stations.length > 0) {
            return NextResponse.json(stations);
        }

        throw new Error('No stations found');
    } catch (error) {
        console.error('Failed to fetch stations list:', error);

        // Fallback list
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
