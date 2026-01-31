import Link from 'next/link';
import { db } from '@/lib/db';
import { Schedule, Record } from '@/types'; // Need to define types
import { Plus, Clock, Disc } from 'lucide-react';
import { ScheduleList } from '@/components/ScheduleList';
import { RecordList } from '@/components/RecordList';

export const dynamic = 'force-dynamic'; // Ensure fresh data

export default function Home() {
  // Fetch data directly from DB
  const schedules = db.prepare('SELECT * FROM schedules ORDER BY start_time ASC').all() as any[]; // quick fix for type
  const records = db.prepare('SELECT * FROM records ORDER BY created_at DESC LIMIT 5').all() as any[];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            ダッシュボード
          </h1>
          <p className="text-slate-400 mt-1">録音状況の概要</p>
        </div>
        <Link
          href="/schedules/new"
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>新規予約</span>
        </Link>
      </div>

      {/* Stats Cards (Simple) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-slate-400 text-sm font-medium">予約中のスケジュール</div>
              <div className="text-2xl font-bold text-white">{schedules.length}</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <Disc className="w-6 h-6" />
            </div>
            <div>
              <div className="text-slate-400 text-sm font-medium">録音済みファイル</div>
              <div className="text-2xl font-bold text-white">{(db.prepare('SELECT COUNT(*) as count FROM records').get() as { count: number }).count}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Schedules */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">今後の予約</h2>
            <Link href="/schedules" className="text-sm text-blue-400 hover:text-blue-300">すべて見る</Link>
          </div>
          <ScheduleList schedules={schedules} />
        </div>

        {/* Recent Recordings */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">最近の録音</h2>
            <Link href="/records" className="text-sm text-blue-400 hover:text-blue-300">すべて見る</Link>
          </div>
          <RecordList records={records} />
        </div>
      </div>
    </div>
  );
}
