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
        <div key={schedule.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center group hover:border-slate-700 transition-all">
          <div>
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
              <h3 className="font-semibold text-slate-200">{schedule.title || '（タイトルなし）'}</h3>
            </div>
            <div className="flex items-center space-x-2 text-sm text-slate-500 mt-1">
              <Calendar className="w-4 h-4" />
              {schedule.recurring_pattern === 'weekly' ? (
                <span>{schedule.start_time}</span>
              ) : (
                <span>{new Date(schedule.start_time).toLocaleString('ja-JP')}</span>
              )}
              <span>•</span>
              <span>{schedule.duration} 分</span>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => router.push(`/schedules/${schedule.id}/edit`)}
              className="p-2 text-slate-600 hover:text-blue-400 hover:bg-blue-950/30 rounded-lg transition-colors"
              title="編集"
            >
              <Calendar className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleDelete(schedule.id)}
              className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
              title="削除"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
