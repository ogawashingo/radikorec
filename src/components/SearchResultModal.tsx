'use client';

import { useState } from 'react';
import { X, Calendar, Clock, Check, Loader2 } from 'lucide-react';

interface Program {
    title: string;
    start_time: string;
    end_time: string;
    station_id: string;
    performer: string;
    description: string;
    status: string;
    display_time?: string;
}

interface SearchResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    keyword: string;
    results: Program[];
    stations: { id: string, name: string }[];
    onReserve: (selected: Program[]) => Promise<void>;
    onDownload: (selected: Program[]) => Promise<void>;
    currentFilter: 'future' | 'past';
    onFilterChange: (filter: 'future' | 'past') => void;
    isLoading: boolean;
}

export function SearchResultModal({
    isOpen,
    onClose,
    keyword,
    results,
    stations,
    onReserve,
    onDownload,
    currentFilter,
    onFilterChange,
    isLoading
}: SearchResultModalProps) {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const toggleSelection = (index: number) => {
        const newSet = new Set(selectedIndices);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedIndices(newSet);
    };

    const toggleAll = () => {
        if (selectedIndices.size === results.length) {
            setSelectedIndices(new Set());
        } else {
            setSelectedIndices(new Set(results.map((_, i) => i)));
        }
    };

    const handleSubmit = async () => {
        if (selectedIndices.size === 0) return;
        setIsProcessing(true);
        const selected = results.filter((_, i) => selectedIndices.has(i));

        if (currentFilter === 'future') {
            await onReserve(selected);
        } else {
            await onDownload(selected);
        }

        setIsProcessing(false);
        setSelectedIndices(new Set());
        onClose();
    };

    // 日付を見やすくフォーマット
    const formatDate = (startStr: string, endStr: string, displayTime?: string) => {
        const d = new Date(startStr);
        const e = new Date(endStr);

        let dateDisplay = d;
        let startTime = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

        if (displayTime) {
            startTime = displayTime;
            const hour = parseInt(displayTime.split(':')[0]);
            if (hour >= 24) {
                // 30時間制の場合、表示上の日付は前日にする
                const adjustedDate = new Date(d);
                adjustedDate.setDate(d.getDate() - 1);
                dateDisplay = adjustedDate;
            }
        } else if (d.getHours() < 5) {
            // display_timeがないが深夜の場合も30時間制にする
            startTime = `${d.getHours() + 24}:${String(d.getMinutes()).padStart(2, '0')}`;
            const adjustedDate = new Date(d);
            adjustedDate.setDate(d.getDate() - 1);
            dateDisplay = adjustedDate;
        }

        const endTime = `${e.getHours()}:${String(e.getMinutes()).padStart(2, '0')}`; // endはとりあえずそのまま、または必要なら調整
        return `${dateDisplay.getMonth() + 1}/${dateDisplay.getDate()} (${['日', '月', '火', '水', '木', '金', '土'][dateDisplay.getDay()]}) ${startTime}-${endTime}`;
    };

    const getStationName = (id: string) => {
        const station = stations.find(s => s.id === id);
        return station ? `${id} ${station.name}` : id;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-sm">
            <div
                className="fixed inset-0"
                onClick={onClose}
            />
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">「{keyword}」の検索結果</h2>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex p-1 bg-slate-200/50 rounded-xl">
                        <button
                            onClick={() => onFilterChange('future')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${currentFilter === 'future'
                                ? 'bg-white text-radiko-blue shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            放送予定 (予約)
                        </button>
                        <button
                            onClick={() => onFilterChange('past')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${currentFilter === 'past'
                                ? 'bg-white text-radiko-blue shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            タイムフリー (即DL)
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-radiko-blue opacity-50" />
                        </div>
                    ) : results.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            {currentFilter === 'future' ? '未来の番組は見つかりませんでした。' : '過去の番組は見つかりませんでした。'}
                        </div>
                    ) : (
                        results.map((prog, index) => {
                            const isSelected = selectedIndices.has(index);
                            return (
                                <div
                                    key={index}
                                    onClick={() => toggleSelection(index)}
                                    className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${isSelected
                                        ? 'bg-blue-50 border-radiko-blue shadow-sm'
                                        : 'bg-white border-transparent shadow-sm hover:border-slate-200'
                                        }`}
                                >
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded">
                                                    {getStationName(prog.station_id)}
                                                </span>
                                                <span className="text-sm font-bold text-radiko-blue flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(prog.start_time, prog.end_time, prog.display_time)}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-slate-800 mb-1 line-clamp-2">{prog.title}</h3>
                                            <p className="text-xs text-slate-500 line-clamp-2">{prog.description}</p>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-radiko-blue border-radiko-blue' : 'border-slate-300'
                                            }`}>
                                            {isSelected && <Check className="w-4 h-4 text-white" />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex justify-between items-center">
                    <button
                        onClick={toggleAll}
                        className="text-sm font-bold text-slate-500 hover:text-slate-800 px-2"
                    >
                        {selectedIndices.size === results.length ? '全て解除' : '全て選択'}
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={selectedIndices.size === 0 || isProcessing}
                            className={`px-6 py-2.5 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2 ${currentFilter === 'future'
                                ? 'bg-radiko-blue hover:bg-blue-600 shadow-blue-200 hover:shadow-blue-300'
                                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200 hover:shadow-emerald-300'
                                }`}
                        >
                            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                            {selectedIndices.size} 件を{currentFilter === 'future' ? '予約' : 'ダウンロード'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
