'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ScheduleList } from '@/components/ScheduleList';
import { Schedule } from '@/types';
import { useEffect, useState } from 'react';

export default function SchedulesPage() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/schedules')
            .then((res) => res.json())
            .then((data) => {
                setSchedules(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to fetch schedules', err);
                setLoading(false);
            });
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">予約一覧</h1>
                <Link
                    href="/schedules/new"
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    <span>新規予約</span>
                </Link>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                {loading ? (
                    <div className="text-slate-500">読み込み中...</div>
                ) : (
                    <ScheduleList schedules={schedules} />
                )}
            </div>
        </div>
    );
}
