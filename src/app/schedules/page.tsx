'use client';

import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { ScheduleList } from '@/components/ScheduleList';
import { Schedule } from '@/types';
import { useEffect, useState, useMemo } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type TabType = 'upcoming' | 'history';

export default function SchedulesPage() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('upcoming');
    const [isClearing, setIsClearing] = useState(false);
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);

    const fetchSchedules = () => {
        setLoading(true);
        fetch('/api/schedules')
            .then((res) => res.json())
            .then((data) => {
                setSchedules(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to fetch schedules', err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchSchedules();
    }, []);

    const upcomingSchedules = useMemo(() => {
        return schedules.filter(s => s.status === 'pending' || s.status === 'processing');
    }, [schedules]);

    const historySchedules = useMemo(() => {
        return schedules.filter(s => s.status === 'completed' || s.status === 'failed');
    }, [schedules]);

    const handleClearHistory = async () => {
        setIsClearing(true);
        try {
            const res = await fetch('/api/schedules/completed', {
                method: 'DELETE',
            });
            if (res.ok) {
                fetchSchedules();
            } else {
                alert('履歴の削除に失敗しました。');
            }
        } catch (error) {
            console.error('Failed to clear history:', error);
            alert('エラーが発生しました。');
        } finally {
            setIsClearing(false);
            setConfirmClearOpen(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">予約一覧</h1>
                <Link
                    href="/schedules/new"
                    className="bg-radiko-blue hover:bg-sky-400 text-white px-6 py-2 rounded-xl flex items-center space-x-2 transition-all font-bold shadow-lg shadow-blue-100"
                >
                    <Plus className="w-4 h-4" />
                    <span>新規予約</span>
                </Link>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'upcoming'
                        ? 'border-radiko-blue text-radiko-blue'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                >
                    予定 ({upcomingSchedules.length})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history'
                        ? 'border-radiko-blue text-radiko-blue'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                >
                    履歴 ({historySchedules.length})
                </button>
            </div>

            <div className="space-y-4">
                {activeTab === 'history' && historySchedules.length > 0 && (
                    <div className="flex justify-end">
                        <button
                            onClick={() => setConfirmClearOpen(true)}
                            disabled={isClearing}
                            className="bg-white border border-red-200 text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg flex items-center space-x-2 transition-all font-bold text-sm shadow-sm hover:shadow-md disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>{isClearing ? '削除中...' : '履歴をすべてクリア'}</span>
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="text-slate-400 font-bold">読み込み中...</div>
                ) : (
                    <ScheduleList schedules={activeTab === 'upcoming' ? upcomingSchedules : historySchedules} />
                )}
            </div>

            <ConfirmDialog
                isOpen={confirmClearOpen}
                onClose={() => setConfirmClearOpen(false)}
                onConfirm={handleClearHistory}
                title="履歴の削除"
                message="完了済み（およびエラー）の予約履歴をすべて削除してもよろしいですか？この操作は元に戻せません。"
            />
        </div>
    );
}
