"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save } from "lucide-react";
import { DatePicker } from "@/components/DatePicker";

interface Program {
    title: string;
    start: string;
    time: string;
    displayTime: string; // Added displayTime
    duration: number;
    performer: string;
    info: string;
    desc: string;
}

interface Station {
    id: string;
    name: string;
}

const daysOfWeek = [
    { id: 0, label: "日" },
    { id: 1, label: "月" },
    { id: 2, label: "火" },
    { id: 3, label: "水" },
    { id: 4, label: "木" },
    { id: 5, label: "金" },
    { id: 6, label: "土" },
];

export default function NewSchedulePage() {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [stationId, setStationId] = useState("");
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [time, setTime] = useState("");

    useEffect(() => {
        setDate(new Date());
    }, []);
    const [duration, setDuration] = useState("60");
    const [isWeekly, setIsWeekly] = useState(false);
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [availablePrograms, setAvailablePrograms] = useState<Program[]>([]);
    const [filteredPrograms, setFilteredPrograms] = useState<Program[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isRealtime, setIsRealtime] = useState(false);

    // マウント時に放送局を取得
    useEffect(() => {
        fetch("/api/stations")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setStations(data);
                }
            })
            .catch(err => console.error("Failed to fetch stations:", err));
    }, []);

    // 放送局または日付が変更されたときに番組を取得
    useEffect(() => {
        if (!stationId) {
            setAvailablePrograms([]);
            return;
        }

        // 毎週予約の場合、選択された曜日を使用して次の発生日を見つける
        // 単発予約の場合、選択された日付を使用
        let referenceDate: Date | undefined;

        if (isWeekly) {
            // 少なくとも1つの曜日が選択されている場合、最初の選択された曜日を使用
            if (selectedDays.length > 0) {
                const today = new Date();
                const todayDayOfWeek = today.getDay();
                const targetDayOfWeek = selectedDays[0];

                // ターゲット曜日までの日数を計算
                let daysUntil = targetDayOfWeek - todayDayOfWeek;
                if (daysUntil < 0) {
                    daysUntil += 7; // Next week
                } else if (daysUntil === 0) {
                    // 今日がターゲット曜日の場合、今日を使用
                    daysUntil = 0;
                }

                referenceDate = new Date(today);
                referenceDate.setDate(today.getDate() + daysUntil);
            } else {
                // まだ曜日が選択されていない場合、フォールバックとして今日を使用
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

    // タイトル入力に基づいて番組をフィルタリング
    useEffect(() => {
        if (!title.trim() || availablePrograms.length === 0) {
            setFilteredPrograms([]);
            return;
        }

        const query = title.toLowerCase();
        const filtered = availablePrograms.filter(p =>
            p.title.toLowerCase().includes(query) ||
            (p.performer || "").toLowerCase().includes(query) ||
            (p.info || "").toLowerCase().includes(query) ||
            (p.desc || "").toLowerCase().includes(query)
        );
        setFilteredPrograms(filtered);
    }, [title, availablePrograms]);

    const handleSelectProgram = (p: Program) => {
        setTitle(p.title);
        setTime(p.time);
        setDuration(String(p.duration));

        const progDateStr = p.start.substring(0, 8); // YYYYMMDD

        if (isWeekly && selectedDays.length > 0) {
            // 毎週予約の場合、番組が「明日」（深夜番組）かどうかをチェック
            // 現在選択されている曜日に対して、期待される日付を再計算して比較する必要がある
            const today = new Date();
            const todayDayOfWeek = today.getDay();
            const targetDayOfWeek = selectedDays[0];
            let daysUntil = targetDayOfWeek - todayDayOfWeek;
            if (daysUntil < 0) daysUntil += 7;

            // 番組の放送日が、ターゲット曜日と異なるかチェック
            const pDate = new Date(
                parseInt(progDateStr.substring(0, 4)),
                parseInt(progDateStr.substring(4, 6)) - 1,
                parseInt(progDateStr.substring(6, 8))
            );
            const pDay = pDate.getDay();

            if (pDay !== targetDayOfWeek) {
                // 番組の放送曜日が、選択中の曜日と異なる（例：金曜深夜25時 → 土曜未明）
                setSelectedDays([pDay]);
                alert(`※深夜等のため、登録曜日を「${daysOfWeek.find(d => d.id === pDay)?.label}」に変更しました。`);
            }
        }
        else if (date) {
            // 単発予約のロジック
            const currentDateStr = date.toLocaleDateString('sv-SE').replace(/-/g, '');
            if (progDateStr > currentDateStr && !isWeekly) {
                // 翌日の日付としてパースして設定
                const nextDay = new Date(
                    parseInt(progDateStr.substring(0, 4)),
                    parseInt(progDateStr.substring(4, 6)) - 1,
                    parseInt(progDateStr.substring(6, 8))
                );
                setDate(nextDay);
                alert(`※深夜等のため、日付を「${nextDay.toLocaleDateString()}」に変更しました。`);
            }
        }
        setShowSuggestions(false);
    };

    const toggleDay = (dayId: number) => {
        if (selectedDays.includes(dayId)) {
            setSelectedDays(selectedDays.filter(id => id !== dayId));
        } else {
            setSelectedDays([...selectedDays, dayId]);
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stationId || !time) {
            alert(`必須項目が不足しています。\n放送局: ${stationId}, 時間: ${time}`);
            return;
        }
        if (!isWeekly && !date) {
            alert('開始日が選択されていません。');
            return;
        }
        if (isWeekly && selectedDays.length === 0) {
            alert('曜日が選択されていません。');
            return;
        }

        // ペイロード配列を作成 (一括登録のサポート)
        const payload = [];

        if (isWeekly) {
            const today = new Date();
            for (const dayId of selectedDays) {
                // ... (calculation omitted)
                const daysUntil = (dayId - today.getDay() + 7) % 7 || 7;
                const nextOccurrence = new Date(today);
                nextOccurrence.setDate(today.getDate() + daysUntil);
                const dateStr = nextOccurrence.toLocaleDateString('sv-SE');
                // For weekly, we just want the time string (e.g. "25:30")
                // But previously we sent ISO.
                // Now we send "HH:mm" (or "25:30") directly.
                const startTime = time;

                payload.push({
                    station_id: stationId,
                    start_time: startTime,
                    duration: parseInt(duration),
                    title: title || "無題の録音",
                    recurring_pattern: 'weekly',
                    day_of_week: dayId,
                    is_realtime: isRealtime
                });
            }
        } else {
            // 単発予約
            const dateStr = date?.toLocaleDateString('sv-SE');
            const startTime = `${dateStr}T${time}`;

            payload.push({
                station_id: stationId,
                start_time: startTime,
                duration: parseInt(duration),
                title: title || "無題の録音",
                recurring_pattern: null,
                day_of_week: null,
                is_realtime: isRealtime
            });
        }

        // ... (fetch to backend)
        const res = await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            router.push("/schedules");
        } else {
            alert('予約の保存に失敗しました');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-4">
                <Link href="/schedules" className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">新規予約作成</h1>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* 1. 放送局選択 (必須) */}
                    <div className="space-y-2">
                        {/* ... */}
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
                        {/* ... Weekly/Date picker ... */}
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

                        {/* リアルタイム録音オプション */}
                        <div className="flex items-center space-x-3 pt-2">
                            <input
                                type="checkbox"
                                id="isRealtime"
                                checked={isRealtime}
                                onChange={(e) => setIsRealtime(e.target.checked)}
                                className="w-5 h-5 rounded border-rose-300 bg-white text-rose-500 focus:ring-rose-500"
                            />
                            <label htmlFor="isRealtime" className="text-slate-800 font-bold cursor-pointer flex items-center gap-2">
                                リアルタイム録音
                                <span className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">タイムフリー非対応番組用</span>
                            </label>
                        </div>
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
                        <p className="text-[11px] text-slate-400 mt-1.5 ml-1">
                            ※土曜日01:00などの深夜番組は、<strong>25:00</strong>扱いとなるため「金曜日」等の<strong>前日の曜日</strong>を選択して検索してください。<br />
                            ※検索に出てこない番組でも、タイトル・時間・録音時間を直接入力して予約可能です。
                        </p>

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
                                        {(p.desc || p.info) && (
                                            <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                                                {p.desc || p.info}
                                            </div>
                                        )}
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
                                type="text"
                                required
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                placeholder="例: 25:30, 01:30"
                                pattern="^([0-2]?[0-9]|3[0-5]):[0-5][0-9]$"
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
                            className="w-full bg-radiko-blue hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-100 transition-all flex items-center justify-center space-x-2 active:scale-[0.98]"
                        >
                            <Save className="w-5 h-5" />
                            <span>予約を保存</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
