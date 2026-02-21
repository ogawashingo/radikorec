'use client';

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
                <h1 className="text-2xl font-bold text-slate-800">予約一覧</h1>
                <Link
                    href="/schedules/new"
                    className="bg-radiko-blue hover:bg-sky-400 text-white px-6 py-2 rounded-xl flex items-center space-x-2 transition-all font-bold shadow-lg shadow-blue-100"
                >
                    <Plus className="w-4 h-4" />
                    <span>新規予約</span>
                </Link>
            </div>

            <div className="">
                {loading ? (
                    <div className="text-slate-400 font-bold">読み込み中...</div>
                ) : (
                    <ScheduleList schedules={schedules} />
                )}
            </div>
        </div>
    );
}
