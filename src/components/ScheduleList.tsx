'use client';

import { Schedule } from '@/types';
import { Trash2, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

export function ScheduleList({ schedules }: { schedules: Schedule[] }) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [optimisticSchedules, setOptimisticSchedules] = useState(schedules);

  useEffect(() => {
    setOptimisticSchedules(schedules);
  }, [schedules]);

  const executeDelete = async () => {
    if (!deleteId) return;

    // Optimistic update
    const previousSchedules = optimisticSchedules;
    setOptimisticSchedules(prev => prev.filter(s => s.id !== deleteId));
    setDeleteId(null);

    try {
      await fetch(`/api/schedules/${deleteId}`, { method: 'DELETE' });
      router.refresh();
    } catch (error) {
      console.error('Failed to delete:', error);
      setOptimisticSchedules(previousSchedules);
      alert('削除に失敗しました');
    }
  };

  if (optimisticSchedules.length === 0) {
    return <div className="text-slate-500 text-sm">予約されたスケジュールはありません。</div>;
  }

  return (
    <div className="space-y-3">
      {optimisticSchedules.map((schedule) => (
        <div key={schedule.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group hover:border-radiko-blue/30 hover:shadow-lg hover:shadow-blue-100/50 transition-all">
          <div className="space-y-2 w-full sm:w-auto">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-bold uppercase border border-slate-200">
                {schedule.station_id}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${schedule.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' :
                schedule.status === 'failed' ? 'bg-red-50 text-red-600 border-red-100' :
                  schedule.status === 'processing' ? 'bg-blue-50 text-radiko-blue border-blue-100 animate-pulse' :
                    'bg-slate-50 text-slate-400 border-slate-100'
                }`}>
                {schedule.status}
              </span>
              {schedule.recurring_pattern === 'weekly' && (
                <span className="bg-purple-50 text-purple-600 text-[10px] px-2 py-0.5 rounded font-bold border border-purple-100">
                  毎週 {['日', '月', '火', '水', '木', '金', '土'][schedule.day_of_week ?? 0]}
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-800 text-lg sm:text-base leading-tight">
              {schedule.title || '（タイトルなし）'}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-medium">
              <div className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5" />
                {schedule.recurring_pattern === 'weekly' ? (
                  <span>{schedule.start_time}</span>
                ) : (
                  <span>{new Date(schedule.start_time).toLocaleString('ja-JP')}</span>
                )}
              </div>
              <span className="opacity-30">•</span>
              <span>{schedule.duration} 分</span>
            </div>

            {schedule.status === 'failed' && schedule.error_message && (
              <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-medium break-words">
                <div className="font-bold mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                  エラーログ
                </div>
                {schedule.error_message}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end border-t border-slate-100 sm:border-0 pt-3 sm:pt-0">
            <button
              onClick={() => router.push(`/schedules/${schedule.id}/edit`)}
              className="flex-1 sm:flex-none p-2.5 text-slate-400 hover:text-radiko-blue hover:bg-blue-50 rounded-xl transition-all flex items-center justify-center border border-slate-100 sm:border-transparent"
              title="編集"
            >
              <Calendar className="w-5 h-5" />
              <span className="sm:hidden ml-2 text-sm font-bold">編集</span>
            </button>
            <button
              onClick={() => setDeleteId(schedule.id)}
              className="flex-1 sm:flex-none p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center border border-slate-100 sm:border-transparent"
              title="削除"
            >
              <Trash2 className="w-5 h-5" />
              <span className="sm:hidden ml-2 text-sm font-bold">削除</span>
            </button>
          </div>
        </div>
      ))}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        title="予約の削除"
        message="この予約を削除してもよろしいですか？"
      />
    </div>
  );
}
