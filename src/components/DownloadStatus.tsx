'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { DownloadJob } from '@/lib/download-manager';

import { useAudio } from '@/context/AudioContext';

export function DownloadStatus() {
    const [jobs, setJobs] = useState<DownloadJob[]>([]);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const { currentRecord } = useAudio();

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/downloads/status');
                if (res.ok) {
                    const data = await res.json();
                    setJobs(data);
                }
            } catch (error) {
                console.error('Failed to fetch download status', error);
            }
        };

        // Poll every 2 seconds
        const interval = setInterval(fetchStatus, 2000);
        fetchStatus();

        return () => clearInterval(interval);
    }, []);

    const handleDismiss = (id: string) => {
        setDismissedIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    };

    const visibleJobs = jobs.filter(job => !dismissedIds.has(job.id));

    if (visibleJobs.length === 0) return null;

    const bottomClass = currentRecord ? 'bottom-32' : 'bottom-4';

    return (
        <div className={`fixed ${bottomClass} right-4 z-[100] flex flex-col gap-2 w-80 transition-all duration-300`}>
            {visibleJobs.map((job) => (
                <div
                    key={job.id}
                    className="bg-white rounded-lg shadow-lg border border-slate-200 p-4 transition-all animate-in slide-in-from-bottom relative group"
                >
                    <button
                        onClick={() => handleDismiss(job.id)}
                        className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-slate-600 border border-slate-200 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        title="閉じる"
                    >
                        <X className="w-3 h-3" />
                    </button>

                    <div className="flex justify-between items-start mb-2 pr-2">
                        <h4 className="font-bold text-sm text-slate-800 line-clamp-1" title={job.title}>
                            {job.title}
                        </h4>
                        {job.status === 'downloading' && (
                            <Loader2 className="w-4 h-4 text-radiko-blue animate-spin shrink-0" />
                        )}
                        {job.status === 'processing' && (
                            <Loader2 className="w-4 h-4 text-purple-500 animate-spin shrink-0" />
                        )}
                        {job.status === 'completed' && (
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        )}
                        {job.status === 'failed' && (
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>
                                {job.status === 'downloading' && 'ダウンロード中...'}
                                {job.status === 'processing' && '変換処理中...'}
                                {job.status === 'completed' && '完了しました'}
                                {job.status === 'failed' && '失敗しました'}
                            </span>
                            <span>{Math.floor(job.progress)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${job.status === 'completed' ? 'bg-green-500' :
                                    job.status === 'failed' ? 'bg-red-500' :
                                        'bg-radiko-blue'
                                    }`}
                                style={{ width: `${job.progress}%` }}
                            />
                        </div>
                        {job.error && (
                            <p className="text-[10px] text-red-500 mt-1">{job.error}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
