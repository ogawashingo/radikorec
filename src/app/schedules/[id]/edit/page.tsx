'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { DatePicker } from '@/components/DatePicker';

interface Station {
    id: string;
    name: string;
}

interface Program {
    title: string;
    start: string;
    time: string;
    displayTime: string; // Added displayTime
    duration: number;
    performer: string;
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

    const [availablePrograms, setAvailablePrograms] = useState<Program[]>([]);
    const [filteredPrograms, setFilteredPrograms] = useState<Program[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

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
                    const dateObj = new Date(scheduleData.start_time);
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

    // Fetch programs when station or date changes
    useEffect(() => {
        if (!stationId) {
            setAvailablePrograms([]);
            return;
        }

        // For weekly schedules, use the selected day of week to find the next occurrence
        // For one-time schedules, use the selected date
        let referenceDate: Date | undefined;

        if (isWeekly) {
            // If at least one day is selected, use the first selected day
            if (selectedDays.length > 0) {
                const today = new Date();
                const todayDayOfWeek = today.getDay();
                const targetDayOfWeek = selectedDays[0];

                // Calculate days until the target day
                let daysUntil = targetDayOfWeek - todayDayOfWeek;
                if (daysUntil < 0) {
                    daysUntil += 7; // Next week
                } else if (daysUntil === 0) {
                    // If today is the target day, use today
                    daysUntil = 0;
                }

                referenceDate = new Date(today);
                referenceDate.setDate(today.getDate() + daysUntil);
            } else {
                // No day selected yet, use today as fallback
                referenceDate = new Date();
            }
        } else {
            referenceDate = date;
        }

        if (!referenceDate) {
            setAvailablePrograms([]);
            return;
        }

        const dateStr = referenceDate.toLocaleDateString('sv-SE').replace(/-/g, '');
        fetch(`/api/programs?station=${stationId}&date=${dateStr}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setAvailablePrograms(data);
                }
            })
            .catch(err => console.error('Failed to fetch programs:', err));
    }, [stationId, date, isWeekly, selectedDays]);

    // Filter programs when title changes
    useEffect(() => {
        if (!title.trim() || availablePrograms.length === 0) {
            setFilteredPrograms([]);
            return;
        }

        const lowerTitle = title.toLowerCase();
        const filtered = availablePrograms.filter(p =>
            p.title.toLowerCase().includes(lowerTitle) ||
            p.performer.toLowerCase().includes(lowerTitle)
        );
        setFilteredPrograms(filtered);
    }, [title, availablePrograms]);

    const handleSelectProgram = (p: Program) => {
        setTitle(p.title);
        setTime(p.time);
        setDuration(String(p.duration));

        // If the program starts on the next calendar day (late night broadcast)
        if (date) {
            const progDateStr = p.start.substring(0, 8);
            const currentDateStr = date.toLocaleDateString('sv-SE').replace(/-/g, '');

            if (progDateStr > currentDateStr && !isWeekly) {
                // Parse the next day date
                const nextDay = new Date(
                    parseInt(progDateStr.substring(0, 4)),
                    parseInt(progDateStr.substring(4, 6)) - 1,
                    parseInt(progDateStr.substring(6, 8))
                );
                setDate(nextDay);
            }
        }

        setShowSuggestions(false);
    };

    const toggleDay = (dayId: number) => {
        setSelectedDays([dayId]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Format start_time for API
        let startTimePayload: string;
        if (isWeekly) {
            // For weekly schedules, use a placeholder date (next occurrence of the selected day)
            if (selectedDays.length === 0) {
                alert('曜日を選択してください');
                setIsLoading(false);
                return;
            }
            const today = new Date();
            const targetDay = selectedDays[0];
            const daysUntil = (targetDay - today.getDay() + 7) % 7 || 7;
            const nextOccurrence = new Date(today);
            nextOccurrence.setDate(today.getDate() + daysUntil);
            const dateStr = nextOccurrence.toLocaleDateString('sv-SE');
            startTimePayload = `${dateStr}T${time}`;
        } else {
            // For one-time schedules, use the selected date
            if (!date) {
                alert('開始日を選択してください');
                setIsLoading(false);
                return;
            }
            const dateStr = date.toLocaleDateString('sv-SE');
            startTimePayload = `${dateStr}T${time}`;
        }

        try {
            const payload: any = {
                station_id: stationId,
                start_time: startTimePayload,
                duration: parseInt(duration, 10),
                title: title || undefined,
                recurring_pattern: isWeekly ? 'weekly' : null,
                day_of_week: isWeekly ? selectedDays[0] : null,
            };

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
            <div className="flex h-64 items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-radiko-blue" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-4">
                <Link href="/schedules" className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-2xl font-bold text-slate-800">予約編集</h1>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* 1. 放送局選択 (必須) */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-600 flex items-center">
                            放送局 <span className="text-rose-500 ml-1">*</span>
                        </label>
                        <select
                            required
                            value={stationId}
                            onChange={(e) => setStationId(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-radiko-blue"
                        >
                            <option value="">放送局を選択してください</option>
                            {stations.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                            ))}
                        </select>
                    </div>

                    {/* 2. 予約タイプ & 日付/曜日 (必須) */}
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center space-x-3 pb-2 border-b border-slate-100">
                            <input
                                type="checkbox"
                                id="isWeekly"
                                checked={isWeekly}
                                onChange={(e) => setIsWeekly(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 bg-white text-radiko-blue focus:ring-radiko-blue"
                            />
                            <label htmlFor="isWeekly" className="text-slate-800 font-bold cursor-pointer">
                                毎週予約する
                            </label>
                        </div>

                        {isWeekly ? (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="text-sm font-bold text-slate-600 flex items-center">
                                    曜日 <span className="text-rose-500 ml-1">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {daysOfWeek.map((d) => (
                                        <button
                                            key={d.id}
                                            type="button"
                                            onClick={() => toggleDay(d.id)}
                                            className={`w-11 h-11 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${selectedDays.includes(d.id)
                                                ? 'bg-radiko-blue text-white shadow-lg shadow-blue-100 scale-105'
                                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                                                }`}
                                        >
                                            {d.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 flex items-center">
                                    開始日 <span className="text-rose-500 ml-1">*</span>
                                </label>
                                <DatePicker
                                    date={date}
                                    setDate={setDate}
                                />
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-slate-100 my-2" />

                    {/* 3. 番組タイトル & 検索 */}
                    <div className="space-y-2 relative">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-slate-600">番組タイトル (検索)</label>
                            {!isWeekly && !stationId && (
                                <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full ring-1 ring-amber-100 italic">放送局と日付を選択して検索</span>
                            )}
                        </div>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            placeholder={stationId ? "番組名や出演者名で検索" : "タイトルを入力 (検索には上の2項目が必要)"}
                            className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-radiko-blue"
                        />

                        {showSuggestions && filteredPrograms.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto ring-1 ring-slate-200/50">
                                {filteredPrograms.map((p, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleSelectProgram(p)}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                                    >
                                        <div className="font-bold text-slate-800 text-sm">{p.title}</div>
                                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2 font-bold">
                                            <span className="text-radiko-blue">{p.displayTime} 〜</span>
                                            <span className="opacity-30">|</span>
                                            <span className="truncate">{p.performer}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        {showSuggestions && (
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowSuggestions(false)}
                            />
                        )}
                    </div>

                    <div className="h-px bg-slate-100 my-2" />

                    {/* 4. 時間 & 録音時間 (自動入力されるため下部へ) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-200">
                        {/* 時間 */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600">開始時間</label>
                            <input
                                type="time"
                                required
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-radiko-blue"
                            />
                        </div>

                        {/* 録音時間 */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600">録音時間 (分)</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-radiko-blue"
                                />
                                <div className="flex gap-1">
                                    {[30, 60].map(min => (
                                        <button
                                            key={min}
                                            type="button"
                                            onClick={() => setDuration(String(min))}
                                            className="px-2 py-2 bg-white hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 transition-all border border-slate-200 shadow-sm"
                                        >
                                            {min}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-radiko-blue hover:bg-sky-400 text-white px-8 py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-[0.98]"
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
