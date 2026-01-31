'use client';

import { RecordList } from '@/components/RecordList';
import { Record } from '@/types';
import { useEffect, useState } from 'react';

export default function RecordsPage() {
    const [records, setRecords] = useState<Record[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/records')
            .then((res) => res.json())
            .then((data) => {
                setRecords(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to fetch records', err);
                setLoading(false);
            });
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">録音リスト</h1>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                {loading ? (
                    <div className="text-slate-500">読み込み中...</div>
                ) : (
                    <RecordList records={records} />
                )}
            </div>
        </div>
    );
}
