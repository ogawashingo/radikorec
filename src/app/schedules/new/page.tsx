'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save } from 'lucide-react';
import Link from 'next/link';

import { DatePicker } from '@/components/DatePicker';
import { format } from 'date-fns';

interface Station {
    id: string;
    name: string;
}

export default function NewSchedulePage() {
    const router = useRouter();
    const [stations, setStations] = useState<Station[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch stations on mount
    useEffect(() => {
        fetch('/api/stations')
            .then(res => res.json())
            .then(data => setStations(data))
            .catch(err => {
                console.error('Failed to fetch stations:', err);
                // Fallback handled in API, but if network fails:
                setStations([]);
            });
    }, []);

    // Form states
    const [stationId, setStationId] = useState('');
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState('60');
    const [title, setTitle] = useState('');

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

    const toggleDay = (dayId: number) => {
        if (selectedDays.includes(dayId)) {
            setSelectedDays(selectedDays.filter(d => d !== dayId));
        } else {
            // 単数選択にするか複数選択にするか要件次第だが、
            // 今回はシンプルに「曜日ごとに1レコード」ではなく「1つのスケジュールで1曜日」とするなら単一選択。
            // しかしUI的には複数選択してまとめて登録できたほうが便利。
            // ここでは「単一選択」として実装し、複数登録したい場合は再度登録してもらう形にするのが安全（DB設計的に）。
            // UIをラジオボタンっぽく振る舞わせる。
            setSelectedDays([dayId]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // 開始日時の構築
        // 毎週予約の場合は日付部分は無視され、時間が使用されるが、DBのNOT NULL制約のためダミーの日付を入れるか、直近の該当曜日を計算する。
        // ここではAPI側が HH:mm を受け取れるようにするか、あるいはクライアントで組み立てる。
        // Schedulerは start_time が 'HH:mm' なら毎週とみなすロジックに変更したが、
        // DBの start_time カラムにはどう保存するか。
        // -> start_time: "HH:mm" で保存し、recurring_pattern="weekly", day_of_week=X とする。

        const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
        let startTimePayload = `${dateStr}T${time}`;
        if (isWeekly) {
            startTimePayload = time; // "HH:mm"
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
                // Date check
                if (!date) {
                    alert('開始日を選択してください');
                    setIsLoading(false);
                    return;
                }
            }

            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('予約に失敗しました');

            router.push('/schedules');
            router.refresh();
        } catch (error) {
            alert('予約の作成中にエラーが発生しました。');
            setIsLoading(false);
        }
    };

    // デフォルトの日付設定 (明日など)
    useEffect(() => {
        const now = new Date();
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');

        setDate(now);
        setTime(`${HH}:${mm}`);
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-4">
                <Link href="/schedules" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-2xl font-bold text-white">新規予約作成</h1>
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
                            placeholder="例: 深夜の音楽番組"
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
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
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
                        /* 日付 (通常予約のみ using DatePicker) */
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
                            <span>{isLoading ? '保存中...' : '予約を保存'}</span>
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
