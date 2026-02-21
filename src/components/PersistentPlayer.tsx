'use client';

import { useAudio } from '@/context/AudioContext';
import { Play, Pause, RotateCcw, RotateCw, X, FastForward } from 'lucide-react';
import { useState, useEffect } from 'react';
import { twMerge } from 'tailwind-merge';

export function PersistentPlayer() {
    const {
        currentRecord,
        isPlaying,
        togglePlay,
        currentTime,
        duration,
        seek,
        skip,
        playbackRate,
        setRate
    } = useAudio();

    // ローカルで閉じたかどうかを管理する状態
    const [isClosed, setIsClosed] = useState(false);

    // currentRecord が変わったら再度表示
    useEffect(() => {
        const timer = setTimeout(() => setIsClosed(false), 0);
        return () => clearTimeout(timer);
    }, [currentRecord?.id]);

    // currentRecord がない場合は表示しない
    if (!currentRecord) return null;

    if (isClosed) return null;

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const mobileRates = [1.0, 1.25, 1.5, 2.0]; // Mobile fits less

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 lg:pl-64">
            <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl shadow-blue-100/50 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                {/* Progress Bar */}
                <div
                    className="h-1.5 bg-slate-100 cursor-pointer group relative"
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const percentage = x / rect.width;
                        seek(percentage * duration);
                    }}
                >
                    <div
                        className="h-full bg-radiko-blue transition-all duration-100 relative"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                    >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border border-radiko-blue rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
                    </div>
                </div>

                <div className="p-4 flex items-center justify-between gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 truncate">
                            {currentRecord.title || currentRecord.filename}
                        </h4>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold">{currentRecord.station_id}</span>
                            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <button
                            onClick={() => skip(-10)}
                            className="p-2 text-slate-400 hover:text-radiko-blue transition-colors"
                            title="10秒戻す (←)"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>

                        <button
                            onClick={togglePlay}
                        >
                            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                        </button>

                        <button
                            onClick={() => skip(30)}
                            className="p-2 text-slate-400 hover:text-radiko-blue transition-colors"
                            title="30秒送る (→)"
                        >
                            <RotateCw className="w-5 h-5" />
                        </button>

                        <div className="hidden sm:flex items-center bg-slate-50 rounded-lg p-1 space-x-1 border border-slate-100">
                            {rates.map(rate => (
                                <button
                                    key={rate}
                                    onClick={() => setRate(rate)}
                                    className={twMerge(
                                        "text-[10px] font-bold px-2 py-1 rounded transition-all",
                                        playbackRate === rate
                                            ? "bg-radiko-blue text-white shadow-sm"
                                            : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {rate}x
                                </button>
                            ))}
                        </div>

                        {/* Mobile Speed Toggle */}
                        <button
                            onClick={() => {
                                const currentIndex = mobileRates.indexOf(playbackRate);
                                const nextIndex = (currentIndex + 1) % mobileRates.length;
                                const nextRate = mobileRates[nextIndex] || 1.0;
                                setRate(nextRate);
                            }}
                            className="sm:hidden p-2 text-slate-400 hover:text-radiko-blue transition-colors flex flex-col items-center"
                        >
                            <FastForward className="w-5 h-5" />
                            <span className="text-[8px] font-bold">{playbackRate}x</span>
                        </button>

                        <button
                            onClick={() => setIsClosed(true)}
                            className="p-2 text-slate-300 hover:text-red-400 transition-colors ml-2"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
