import React from 'react';

interface StatusBadgeProps {
    status?: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
    if (!status) return <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase border bg-slate-50 text-slate-400 border-slate-100">{status}</span>;

    if (status === 'completed') return <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase border bg-green-50 text-green-600 border-green-100">{status}</span>;
    if (status === 'failed') return <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase border bg-red-50 text-red-600 border-red-100">{status}</span>;
    if (status === 'processing') return <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase border bg-blue-50 text-radiko-blue border-blue-100 animate-pulse">{status}</span>;

    return <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase border bg-slate-50 text-slate-400 border-slate-100">{status}</span>;
}
