'use client';

import { useState, useEffect } from 'react';
import { Terminal, RefreshCw } from 'lucide-react';

interface LogEntry {
    time: string;
    level: number;
    msg: string;
    [key: string]: unknown;
}

const levelMap: Record<number, { label: string, color: string }> = {
    10: { label: 'TRACE', color: 'text-gray-400' },
    20: { label: 'DEBUG', color: 'text-blue-400' },
    30: { label: 'INFO', color: 'text-green-400' },
    40: { label: 'WARN', color: 'text-yellow-400' },
    50: { label: 'ERROR', color: 'text-red-400' },
    60: { label: 'FATAL', color: 'text-red-600 font-bold' },
};

export function LogViewer() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/logs');
            const data = await res.json();
            if (data.logs) {
                setLogs(data.logs);
            }
        } catch (e) {
            console.error('Failed to fetch logs', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 30000); // 30秒ごとに更新
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700">
                <div className="flex items-center space-x-2 text-slate-300">
                    <Terminal className="w-5 h-5" />
                    <span className="font-bold text-sm">システムログ (最新100件)</span>
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="p-1 hover:bg-slate-700 rounded-lg transition-colors text-slate-400"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="p-4 h-96 overflow-y-auto font-mono text-xs space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {logs.length === 0 && !loading && (
                    <div className="text-slate-500 italic text-center py-8">ログがありません</div>
                )}
                {logs.map((log, i) => {
                    const levelInfo = levelMap[log.level] || { label: 'LOG', color: 'text-gray-300' };
                    const timeStr = new Date(log.time).toLocaleTimeString();

                    return (
                        <div key={i} className="flex space-x-2 hover:bg-slate-800/30 py-0.5 px-1 rounded">
                            <span className="text-slate-500 shrink-0">[{timeStr}]</span>
                            <span className={`${levelInfo.color} shrink-0 w-12`}>{levelInfo.label}</span>
                            <span className="text-slate-200 break-all">{log.msg}</span>
                            {Object.keys(log).filter(k => !['time', 'level', 'msg', 'env', 'v'].includes(k)).map(k => (
                                <span key={k} className="text-slate-400 italic">
                                    {k}={typeof log[k] === 'object' && log[k] !== null ? JSON.stringify(log[k]) : String(log[k])}
                                </span>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
