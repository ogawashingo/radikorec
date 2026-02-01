'use client';

import { Schedule } from '@/types';
import { Trash2, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ScheduleList({ schedules }: { schedules: Schedule[] }) {
  const router = useRouter();

  const handleDelete = async (id: number) => {
    if (!confirm('この予約を削除してもよろしいですか？')) return;

    await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    router.refresh();
  };

  if (schedules.length === 0) {
    return <div className="text-slate-500 text-sm">予約されたスケジュールはありません。</div>;
  }

  return (
    <div className="space-y-3">
      {schedules.map((schedule) => (
        <div key={schedule.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group hover:border-slate-700 transition-all">
          <div className="space-y-2 w-full sm:w-auto">
            <div className="flex items-center space-x-2">
              <span className="bg-blue-900/30 text-blue-400 text-xs px-2 py-0.5 rounded font-mono uppercase">
                {schedule.station_id}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded uppercase ${schedule.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                schedule.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                  schedule.status === 'processing' ? 'bg-yellow-900/30 text-yellow-400' :
                    'bg-slate-700 text-slate-400'
                }`}>
                {schedule.status}
              </span>
              {schedule.recurring_pattern === 'weekly' && (
                <span className="bg-purple-900/30 text-purple-400 text-xs px-2 py-0.5 rounded font-mono">
                  毎週 {['日', '月', '火', '水', '木', '金', '土'][schedule.day_of_week ?? 0]}
                </span>
              )}
              <h3 className="font-semibold text-slate-200 text-lg sm:text-base leading-tight">
                {schedule.title || '（タイトルなし）'}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 mt-1">
              <Calendar className="w-4 h-4" />
              {schedule.recurring_pattern === 'weekly' ? (
                <span>{schedule.start_time}</span>
              ) : (
                <span>{new Date(schedule.start_time).toLocaleString('ja-JP')}</span>
              )}
              <span>•</span>
              <span>{schedule.duration} 分</span>
            </div>

            {schedule.status === 'failed' && schedule.error_message && (
              <div className="mt-2 p-2 bg-red-950/20 border border-red-900/30 rounded text-xs text-red-400 font-mono break-words">
                <div className="font-bold mb-1 opacity-70">Error Log:</div>
                {schedule.error_message}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end border-t border-slate-800 sm:border-0 pt-3 sm:pt-0">
            <button
              onClick={() => router.push(`/schedules/${schedule.id}/edit`)}
              className="flex-1 sm:flex-none p-3 sm:p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-950/30 rounded-lg transition-colors flex items-center justify-center border border-slate-800 sm:border-0"
              title="編集"
            >
              <Calendar className="w-5 h-5" />
              <span className="sm:hidden ml-2 text-sm">編集</span>
            </button>
            <button
              onClick={() => handleDelete(schedule.id)}
              className="flex-1 sm:flex-none p-3 sm:p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors flex items-center justify-center border border-slate-800 sm:border-0"
              title="削除"
            >
              <Trash2 className="w-5 h-5" />
              <span className="sm:hidden ml-2 text-sm">削除</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
