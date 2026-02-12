'use client';

import { Record } from '@/types';
import { Trash2, Play, Download, Pause, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import { useAudio } from '@/context/AudioContext';
import { twMerge } from 'tailwind-merge';
import { ConfirmDialog } from './ConfirmDialog';

export function RecordList({ records }: { records: Record[] }) {
  const router = useRouter();
  const { currentRecord, isPlaying, playRecord, togglePlay, playbackHistory, currentTime, duration } = useAudio();
  const [optimisticRecords, setOptimisticRecords] = useState(records);
  const [stations, setStations] = useState<{ id: string, name: string }[]>([]);

  useEffect(() => {
    setOptimisticRecords(records);
  }, [records]);

  useEffect(() => {
    // 放送局リストを取得
    fetch('/api/stations')
      .then(res => res.json())
      .then(data => setStations(data))
      .catch(err => console.error('放送局リストの取得に失敗:', err));
  }, []);

  const getStationLabel = (id: string) => {
    const station = stations.find(s => s.id === id);
    return station ? `${id} ${station.name}` : id;
  };

  // グループ化の状態
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deleteFilename, setDeleteFilename] = useState<string | null>(null);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const groupedRecords = useMemo(() => {
    const groups: { [key: string]: Record[] } = {};
    const noTitleKey = 'その他';

    optimisticRecords.forEach(record => {
      const key = record.title || noTitleKey;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record);
    });

    // ソートキー: 指定されたタイトルを最初に、次に"その他"
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === noTitleKey) return 1;
      if (b === noTitleKey) return -1;
      return a.localeCompare(b, 'ja');
    });

    return sortedKeys.map(key => ({
      title: key,
      items: groups[key].sort((a, b) => new Date(b.start_time || b.created_at).getTime() - new Date(a.start_time || a.created_at).getTime())
    }));
  }, [optimisticRecords]);

  const executeDelete = async () => {
    if (!deleteFilename) return;

    // 楽観的更新
    const previous = optimisticRecords;
    setOptimisticRecords(prev => prev.filter(r => r.filename !== deleteFilename));
    setDeleteFilename(null);

    try {
      await fetch(`/api/records/${deleteFilename}`, { method: 'DELETE' });
      router.refresh();
    } catch (e) {
      console.error(e);
      setOptimisticRecords(previous);
      alert('削除に失敗しました');
    }
  };

  const isThisPlaying = (record: Record) => {
    return currentRecord?.id === record.id && isPlaying;
  };

  const toggleWatched = async (record: Record) => {
    const newStatus = record.is_watched ? 0 : 1;

    // 楽観的更新
    setOptimisticRecords(prev => prev.map(r =>
      r.filename === record.filename ? { ...r, is_watched: newStatus } : r
    ));

    try {
      const res = await fetch(`/api/records/${record.filename}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_watched: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');
      router.refresh();
    } catch (e) {
      console.error(e);
      // 元に戻す
      setOptimisticRecords(prev => prev.map(r =>
        r.filename === record.filename ? { ...r, is_watched: record.is_watched } : r
      ));
      alert('視聴状態の更新に失敗しました');
    }
  };


  if (optimisticRecords.length === 0) {
    return <div className="text-slate-500 text-sm">録音ファイルは見つかりませんでした。</div>;
  }

  return (
    <div className="space-y-4">
      {groupedRecords.map((group) => (
        <div key={group.title} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <button
            onClick={() => toggleGroup(group.title)}
            className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center space-x-3 text-left">
              <div className="p-2 bg-blue-50 rounded-xl">
                <Folder className="w-5 h-5 text-radiko-blue" />
              </div>
              <span className="font-bold text-slate-800">{group.title}</span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                {group.items.length}
              </span>
            </div>
            {expandedGroups.has(group.title) ? (
              <ChevronDown className="w-5 h-5 text-slate-300" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-300" />
            )}
          </button>

          {expandedGroups.has(group.title) && (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {group.items.map((record) => (
                <div key={record.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/50 transition-colors pl-6">
                  <div className="flex items-start sm:items-center space-x-4 w-full">
                    <button
                      onClick={() => playRecord(record)}
                      className={twMerge(
                        "w-10 h-10 sm:w-9 sm:h-9 shrink-0 rounded-full flex items-center justify-center transition-all border shadow-sm relative group",
                        isThisPlaying(record)
                          ? "bg-radiko-blue text-white border-radiko-blue shadow-blue-200"
                          : "bg-white text-slate-400 border-slate-200 hover:border-radiko-blue hover:text-radiko-blue"
                      )}
                    >
                      {/* Progress Ring */}
                      {(() => {
                        let progress = 0;
                        let total = record.duration || 1;

                        if (isThisPlaying(record)) {
                          progress = currentTime;
                          total = duration || total;
                        } else {
                          const history = playbackHistory[record.id];
                          if (history) {
                            progress = history.currentTime;
                            total = history.duration || total;
                          }
                        }

                        if (progress <= 0) return null;

                        const percent = Math.min(1, progress / total);

                        const size = 40; // Desktop size
                        const strokeWidth = 2;
                        const radius = (size - strokeWidth) / 2;
                        const circumference = radius * 2 * Math.PI;
                        const offset = circumference - percent * circumference;

                        return (
                          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none opacity-20 sm:opacity-30" viewBox={`0 0 ${size} ${size}`}>
                            <circle
                              cx={size / 2}
                              cy={size / 2}
                              r={radius}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={strokeWidth}
                            />
                            <circle
                              cx={size / 2}
                              cy={size / 2}
                              r={radius}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={strokeWidth}
                              strokeDasharray={circumference}
                              strokeDashoffset={offset}
                              strokeLinecap="round"
                              className="text-radiko-blue"
                            />
                          </svg>
                        );
                      })()}

                      {isThisPlaying(record) ? <Pause className="w-5 h-5 sm:w-4 sm:h-4 relative z-10" /> : <Play className="w-5 h-5 sm:w-4 sm:h-4 ml-0.5 relative z-10" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-slate-800 break-words line-clamp-2 md:line-clamp-1">
                          {record.filename}
                        </div>
                        {record.is_watched === 0 && (
                          <span className="shrink-0 bg-red-100 text-red-600 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-red-200 uppercase tracking-wider">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap gap-x-2 gap-y-1 font-bold">
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase border border-slate-200">
                          {getStationLabel(record.station_id)}
                        </span>
                        <span className="mt-0.5 font-medium">{(() => {
                          const timeSource = record.start_time || record.created_at;
                          const d = new Date(timeSource);

                          let displayH = d.getHours();
                          let displayD = d;

                          // 深夜5時前であれば前日の24時以降として表示
                          if (displayH < 5) {
                            displayH += 24;
                            displayD = new Date(d);
                            displayD.setDate(d.getDate() - 1);
                          }

                          const month = displayD.getMonth() + 1;
                          const day = displayD.getDate();
                          const hours = String(displayH).padStart(2, '0');
                          const minutes = String(d.getMinutes()).padStart(2, '0');

                          return `${month}/${day} ${hours}:${minutes}`;
                        })()}</span>
                        <span className="hidden sm:inline opacity-30 mt-0.5">•</span>
                        <span className="mt-0.5 font-medium">{
                          record.size < 1024 * 1024
                            ? `${Math.round(record.size / 1024)} KB`
                            : `${(record.size / 1024 / 1024).toFixed(1)} MB`
                        }</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 w-full sm:w-auto justify-end border-t border-slate-100 sm:border-0 pt-2 sm:pt-0">
                    <button
                      onClick={() => toggleWatched(record)}
                      className={twMerge(
                        "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border flex items-center justify-center gap-1.5",
                        record.is_watched
                          ? "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                          : "bg-blue-50 text-radiko-blue border-blue-100 hover:bg-blue-100"
                      )}
                    >
                      <div className={twMerge(
                        "w-2 h-2 rounded-full",
                        record.is_watched ? "bg-slate-300" : "bg-radiko-blue animate-pulse"
                      )} />
                      {record.is_watched ? '視聴済み' : '未視聴'}
                    </button>
                    <a
                      href={`/api/records/${record.filename}?download=true`}
                      download
                      className="flex-1 sm:flex-none p-2.5 text-slate-400 hover:text-radiko-blue hover:bg-blue-50 rounded-xl transition-all flex items-center justify-center border border-slate-100 sm:border-transparent"
                      title="ダウンロード"
                    >
                      <Download className="w-5 h-5 sm:w-4 sm:h-4" />
                      <span className="sm:hidden ml-2 text-sm font-bold">保存</span>
                    </a>
                    <button
                      onClick={() => setDeleteFilename(record.filename)}
                      className="flex-1 sm:flex-none p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center border border-slate-100 sm:border-transparent"
                      title="削除"
                    >
                      <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                      <span className="sm:hidden ml-2 text-sm font-bold">削除</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))
      }
      <ConfirmDialog
        isOpen={!!deleteFilename}
        onClose={() => setDeleteFilename(null)}
        onConfirm={executeDelete}
        title="ファイルの削除"
        message="本当に削除してもよろしいですか？ ファイルは完全に削除されます。"
        isDestructive={true}
      />
    </div >
  );
}
