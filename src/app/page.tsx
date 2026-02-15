import Link from 'next/link';
import { drizzleDb } from '@/lib/db';
import { schedules, records } from '@/lib/schema';
import { desc, asc, sql } from 'drizzle-orm';
import { Plus, Clock, Disc } from 'lucide-react';
import { ScheduleList } from '@/components/ScheduleList';
import { RecordList } from '@/components/RecordList';
import { LogViewer } from '@/components/LogViewer';

export const dynamic = 'force-dynamic'; // Ensure fresh data

export default function Home() {
  // DBから直接データを取得
  const allSchedules = drizzleDb.select().from(schedules).orderBy(asc(schedules.start_time)).all().map(s => ({
    ...s,
    // Status in DB is string, but Type expects specific union
    status: (s.status as "pending" | "processing" | "completed" | "failed")
  }));
  const recentRecords = drizzleDb.select().from(records).orderBy(desc(records.created_at)).limit(5).all();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            ダッシュボード
          </h1>
          <p className="text-slate-500 mt-1">録音状況の概要</p>
        </div>
        <Link
          href="/schedules/new"
          className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-radiko-blue hover:bg-sky-400 text-white px-6 py-3 sm:py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-5 h-5" />
          <span>新規予約</span>
        </Link>
      </div>


      {/* Stats Cards (Simple) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-50 rounded-xl text-radiko-blue">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-slate-500 text-sm font-medium">予約中のスケジュール</div>
              <div className="text-2xl font-bold text-slate-800">{allSchedules.length}</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
              <Disc className="w-6 h-6" />
            </div>
            <div>
              <div className="text-slate-500 text-sm font-medium">録音済みファイル</div>
              <div className="text-2xl font-bold text-slate-800">{drizzleDb.select({ count: sql<number>`count(*)` }).from(records).get()?.count ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Schedules */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xl font-bold text-slate-800">今後の予約</h2>
            <Link href="/schedules" className="text-sm font-bold text-radiko-blue hover:text-sky-500">すべて見る</Link>
          </div>
          <ScheduleList schedules={allSchedules} />
        </div>

        {/* Recent Recordings */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xl font-bold text-slate-800">最近の録音</h2>
            <Link href="/records" className="text-sm font-bold text-radiko-blue hover:text-sky-500">すべて見る</Link>
          </div>
          <RecordList records={recentRecords} />
        </div>
      </div>

      {/* System Logs */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800 px-1">システムログ</h2>
        <LogViewer />
      </div>
    </div>
  );
}
