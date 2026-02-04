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
}

interface SearchResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    keyword: string;
    results: Program[];
    stations: { id: string, name: string }[];
    onReserve: (selected: Program[]) => Promise<void>;
}

export function SearchResultModal({ isOpen, onClose, keyword, results, stations, onReserve }: SearchResultModalProps) {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [isReserving, setIsReserving] = useState(false);

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

    const handleReserve = async () => {
        if (selectedIndices.size === 0) return;
        setIsReserving(true);
        const selected = results.filter((_, i) => selectedIndices.has(i));
        await onReserve(selected);
        setIsReserving(false);
        setSelectedIndices(new Set());
        onClose();
    };

    // 日付を見やすくフォーマット
    const formatDate = (startStr: string, endStr: string) => {
        const d = new Date(startStr);
        const e = new Date(endStr);
        const startTime = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
        const endTime = `${e.getHours()}:${String(e.getMinutes()).padStart(2, '0')}`;
        return `${d.getMonth() + 1}/${d.getDate()} (${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}) ${startTime}-${endTime}`;
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
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">「{keyword}」の検索結果</h2>
                        <p className="text-sm text-slate-500 mt-1">{results.length} 件の番組が見つかりました</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
                    {results.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            未来の番組は見つかりませんでした。
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
                                                    {formatDate(prog.start_time, prog.end_time)}
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
                            onClick={handleReserve}
                            disabled={selectedIndices.size === 0 || isReserving}
                            className="px-6 py-2.5 bg-radiko-blue text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-600 hover:shadow-blue-300 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                        >
                            {isReserving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {selectedIndices.size} 件を予約
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
