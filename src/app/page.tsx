import Link from 'next/link';
import { drizzleDb } from '@/lib/db';
import { schedules, records } from '@/lib/schema';
import { desc, asc, sql } from 'drizzle-orm';
import { Plus, Clock, Disc } from 'lucide-react';
import { ScheduleList } from '@/components/ScheduleList';
import { RecordList } from '@/components/RecordList';
import { LogViewer } from '@/components/LogViewer';
import fs from 'fs';
import { formatFileSize } from '@/lib/notifier';
import { getGitInfo } from '@/lib/git';

export const dynamic = 'force-dynamic'; // Ensure fresh data

export default function Home() {
  // DBから直接データを取得
  const allSchedules = drizzleDb.select().from(schedules).orderBy(asc(schedules.start_time)).all().map(s => ({
    ...s,
    // Status in DB is string, but Type expects specific union
    status: (s.status as "pending" | "processing" | "completed" | "failed")
  }));
  const recentRecords = drizzleDb.select().from(records).orderBy(desc(records.created_at)).limit(5).all();

  // 録音ファイルの合計サイズ
  const dbSizeRow = drizzleDb.select({ total: sql<number>`SUM(size)` }).from(records).get();
  const radikoUsedSpace = dbSizeRow?.total || 0;

  // ディスクの空き容量 (public/records フォルダがあるパーティション)
  let totalSpace = 0;
  let freeSpace = 0;
  try {
    const stat = fs.statfsSync('./public/records');
    totalSpace = stat.blocks * stat.bsize;
    freeSpace = stat.bfree * stat.bsize;
  } catch (e) {
    console.error('Failed to get disk space:', e);
  }
  const otherUsedSpace = Math.max(0, totalSpace - freeSpace - radikoUsedSpace);
  const radikoPercent = totalSpace > 0 ? (radikoUsedSpace / totalSpace) * 100 : 0;
  const otherPercent = totalSpace > 0 ? (otherUsedSpace / totalSpace) * 100 : 0;
  const freePercent = totalSpace > 0 ? (freeSpace / totalSpace) * 100 : 0;
  const gitInfo = getGitInfo();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            ダッシュボード
          </h1>
          {gitInfo && (
            <p className="text-xs text-slate-400 mt-1 font-mono">
              ver: {gitInfo.hash} ({gitInfo.date})
            </p>
          )}
        </div>
        <Link
          href="/schedules/new"
          className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-radiko-blue hover:bg-sky-400 text-white px-6 py-3 sm:py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-5 h-5" />
          <span>新規予約</span>
        </Link>
      </div>


      {/* Storage Card */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4">ストレージ使用状況</h3>

        {totalSpace > 0 ? (
          <div className="space-y-4">
            {/* Stacked Progress Bar */}
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-radiko-blue transition-all duration-500"
                style={{ width: `${radikoPercent}%` }}
                title={`radikoRec録音ファイル: ${formatFileSize(radikoUsedSpace)}`}
              />
              <div
                className="bg-slate-300 transition-all duration-500"
                style={{ width: `${otherPercent}%` }}
                title={`その他利用: ${formatFileSize(otherUsedSpace)}`}
              />
              {/* 空き容量は背景色 (slate-100) */}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-radiko-blue" />
                <span className="text-slate-600 font-medium">録音ファイル</span>
                <span className="font-bold text-slate-800">{formatFileSize(radikoUsedSpace)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-slate-100 border border-slate-200" />
                <span className="text-slate-600 font-medium">空き容量</span>
                <span className="font-bold text-slate-800">{formatFileSize(freeSpace)}</span>
              </div>
              <div className="text-slate-400 text-xs text-right w-full sm:w-auto">
                全体: {formatFileSize(totalSpace)}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">ストレージ情報を取得できませんでした。</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Recordings */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xl font-bold text-slate-800">最近の録音</h2>
            <Link href="/records" className="text-sm font-bold text-radiko-blue hover:text-sky-500">すべて見る</Link>
          </div>
          <RecordList records={recentRecords} />
        </div>

        {/* Schedules */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xl font-bold text-slate-800">今後の予約</h2>
            <Link href="/schedules" className="text-sm font-bold text-radiko-blue hover:text-sky-500">すべて見る</Link>
          </div>
          <ScheduleList schedules={allSchedules} />
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
