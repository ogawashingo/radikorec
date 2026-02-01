'use client';

import { Record } from '@/types';
import { Trash2, Play, Download, Pause, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { useAudio } from '@/context/AudioContext';

export function RecordList({ records }: { records: Record[] }) {
  const router = useRouter();
  const { currentRecord, isPlaying, playRecord, togglePlay } = useAudio();

  // Grouping state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

    records.forEach(record => {
      const key = record.title || noTitleKey;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record);
    });

    // Sort keys: specified titles first, then "Others"
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === noTitleKey) return 1;
      if (b === noTitleKey) return -1;
      return a.localeCompare(b, 'ja');
    });

    return sortedKeys.map(key => ({
      title: key,
      items: groups[key].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }));
  }, [records]);

  const handleDelete = async (filename: string) => {
    if (!confirm('本当に削除してもよろしいですか？ ファイルは完全に削除されます。')) return;
    await fetch(`/api/records/${filename}`, { method: 'DELETE' });
    router.refresh();
  };

  const isThisPlaying = (record: Record) => {
    return currentRecord?.id === record.id && isPlaying;
  };


  if (records.length === 0) {
    return <div className="text-slate-500 text-sm">録音ファイルは見つかりませんでした。</div>;
  }

  return (
    <div className="space-y-4">
      {groupedRecords.map((group) => (
        <div key={group.title} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30">
          <button
            onClick={() => toggleGroup(group.title)}
            className="w-full flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Folder className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-slate-200">{group.title}</span>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                {group.items.length}
              </span>
            </div>
            {expandedGroups.has(group.title) ? (
              <ChevronDown className="w-5 h-5 text-slate-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-500" />
            )}
          </button>

          {expandedGroups.has(group.title) && (
            <div className="divide-y divide-slate-800/50 border-t border-slate-800">
              {group.items.map((record) => (
                <div key={record.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-800/50 transition-colors pl-6">
                  <div className="flex items-start sm:items-center space-x-4 w-full">
                    <button
                      onClick={() => playRecord(record)}
                      className="w-10 h-10 sm:w-8 sm:h-8 shrink-0 rounded-full bg-slate-800 flex items-center justify-center text-blue-400 hover:bg-blue-600 hover:text-white transition-all border border-slate-700 hover:border-blue-500"
                    >
                      {isThisPlaying(record) ? <Pause className="w-5 h-5 sm:w-4 sm:h-4" /> : <Play className="w-5 h-5 sm:w-4 sm:h-4 ml-0.5" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-300 break-words line-clamp-2 md:line-clamp-1">
                        {record.filename}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-2 gap-y-1">
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] uppercase">{record.station_id}</span>
                        <span>{new Date(record.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="hidden sm:inline opacity-30">•</span>
                        <span>{
                          record.size < 1024 * 1024
                            ? `${Math.round(record.size / 1024)} KB`
                            : `${(record.size / 1024 / 1024).toFixed(1)} MB`
                        }</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 w-full sm:w-auto justify-end border-t border-slate-800/50 sm:border-0 pt-2 sm:pt-0">
                    <a
                      href={`/api/records/${record.filename}?download=true`}
                      download
                      className="flex-1 sm:flex-none p-3 sm:p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-950/30 rounded-lg transition-colors flex items-center justify-center border border-slate-800 sm:border-0"
                      title="ダウンロード"
                    >
                      <Download className="w-5 h-5 sm:w-4 sm:h-4" />
                      <span className="sm:hidden ml-2 text-sm">保存</span>
                    </a>
                    <button
                      onClick={() => handleDelete(record.filename)}
                      className="flex-1 sm:flex-none p-3 sm:p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors flex items-center justify-center border border-slate-800 sm:border-0"
                      title="削除"
                    >
                      <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                      <span className="sm:hidden ml-2 text-sm">削除</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
