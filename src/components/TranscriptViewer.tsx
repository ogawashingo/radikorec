'use client';

import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface TranscriptViewerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    transcript: string;
}

export function TranscriptViewer({ isOpen, onClose, title, transcript }: TranscriptViewerProps) {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(transcript);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* 背景オーバーレイ */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* モーダル本体 */}
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">文字起こし</p>
                        <h2 className="text-sm font-bold text-slate-800 truncate">{title}</h2>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            {copied
                                ? <><Check className="w-3.5 h-3.5 text-green-500" />コピー済み</>
                                : <><Copy className="w-3.5 h-3.5" />全文コピー</>
                            }
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 文字起こし本文 */}
                <div className="overflow-y-auto flex-1 p-5">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-sans">
                        {transcript}
                    </pre>
                </div>
            </div>
        </div>
    );
}
