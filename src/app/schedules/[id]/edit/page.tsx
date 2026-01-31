'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { DatePicker } from '@/components/DatePicker';
import { format, parseISO } from 'date-fns';

interface Station {
    id: string;
    name: string;
}

export default function EditSchedulePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [stations, setStations] = useState<Station[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    // Form states
    const [stationId, setStationId] = useState('');
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState('60');
    const [title, setTitle] = useState('');

    // Weekly states
    const [isWeekly, setIsWeekly] = useState(false);
    const [selectedDays, setSelectedDays] = useState<number[]>([]);

    const daysOfWeek = [
        { id: 0, label: '日' },
        { id: 1, label: '月' },
        { id: 2, label: '火' },
        { id: 3, label: '水' },
        { id: 4, label: '木' },
        { id: 5, label: '金' },
        { id: 6, label: '土' },
    ];

    // Initialize data
    useEffect(() => {
        Promise.all([
            fetch('/api/stations').then(res => res.json()),
            fetch(`/api/schedules/${id}`).then(res => {
                if (!res.ok) throw new Error('Schedule not found');
                return res.json();
            })
        ]).then(([stationsData, scheduleData]) => {
            setStations(stationsData);

            // Populate form
            setStationId(scheduleData.station_id);
            setDuration(String(scheduleData.duration));
            setTitle(scheduleData.title || '');

            if (scheduleData.recurring_pattern === 'weekly') {
                setIsWeekly(true);
                setTime(scheduleData.start_time); // "HH:mm"
                if (scheduleData.day_of_week !== null) {
                    setSelectedDays([scheduleData.day_of_week]);
                }
                setDate(undefined);
            } else {
                // One-time: "YYYY-MM-DDTHH:mm"
                try {
                    const dateObj = parseISO(scheduleData.start_time);
                    setDate(dateObj);

                    const hh = String(dateObj.getHours()).padStart(2, '0');
                    const mm = String(dateObj.getMinutes()).padStart(2, '0');
                    setTime(`${hh}:${mm}`);
                } catch (e) { console.error(e); }
                setIsWeekly(false);
            }

            setIsFetching(false);
        }).catch(err => {
            console.error(err);
            alert('データの読み込みに失敗しました');
            router.push('/schedules');
        });
    }, [id, router]);

    const toggleDay = (dayId: number) => {
        setSelectedDays([dayId]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
        let startTimePayload = `${dateStr}T${time}`;
        if (isWeekly) {
            startTimePayload = time;
        }

        try {
            const payload: any = {
                station_id: stationId,
                start_time: startTimePayload,
                duration: parseInt(duration, 10),
                title: title || undefined
            };

            if (isWeekly) {
                if (selectedDays.length === 0) {
                    alert('曜日を選択してください');
                    setIsLoading(false);
                    return;
                }
                payload.recurring_pattern = 'weekly';
                payload.day_of_week = selectedDays[0];
            } else {
                if (!date) {
                    alert('開始日を選択してください');
                    setIsLoading(false);
                    return;
                }
                payload.recurring_pattern = null;
                payload.day_of_week = null;
            }

            const res = await fetch(`/api/schedules/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('更新に失敗しました');

            router.push('/schedules');
            router.refresh();
        } catch (error) {
            alert('更新中にエラーが発生しました。');
            setIsLoading(false);
        }
    };

    if (isFetching) {
        return (
            <div className="flex h-64 items-center justify-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-4">
                <Link href="/schedules" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-2xl font-bold text-white">予約編集</h1>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* タイトル */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">番組タイトル (任意)</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* 放送局選択 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">放送局</label>
                        <select
                            value={stationId}
                            onChange={(e) => setStationId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {stations.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                            ))}
                        </select>
                    </div>

                    {/* 予約タイプ (通常/毎週) */}
                    <div className="flex items-center space-x-3 pb-2 border-b border-slate-800/50">
                        <input
                            type="checkbox"
                            id="isWeekly"
                            checked={isWeekly}
                            onChange={(e) => setIsWeekly(e.target.checked)}
                            className="w-5 h-5 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                        />
                        <label htmlFor="isWeekly" className="text-white font-medium cursor-pointer">
                            毎週予約する
                        </label>
                    </div>

                    {isWeekly ? (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">曜日</label>
                            <div className="flex space-x-2">
                                {daysOfWeek.map((d) => (
                                    <button
                                        key={d.id}
                                        type="button"
                                        onClick={() => toggleDay(d.id)}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${selectedDays.includes(d.id)
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-105'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                            }`}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">開始日</label>
                            <DatePicker
                                date={date}
                                setDate={setDate}
                            />
                        </div>
                    )}

                    {/* 時間 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">開始時間</label>
                        <input
                            type="time"
                            required
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* 録音時間 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">録音時間 (分)</label>
                        <div className="flex items-center space-x-4">
                            <input
                                type="number"
                                min="1"
                                required
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="w-32 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex space-x-2">
                                {[30, 60, 120].map(min => (
                                    <button
                                        key={min}
                                        type="button"
                                        onClick={() => setDuration(String(min))}
                                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-300 transition-colors"
                                    >
                                        {min}分
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-end">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-5 h-5" />
                            <span>{isLoading ? '保存中...' : '変更を保存'}</span>
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
