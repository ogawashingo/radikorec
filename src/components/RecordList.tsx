'use client';

import { Record } from '@/types';
import { Trash2, Play, Download, Pause, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useMemo } from 'react';

export function RecordList({ records }: { records: Record[] }) {
  const router = useRouter();
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const togglePlay = (record: Record) => {
    if (playingId === record.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`/api/records/${record.filename}`);
      audio.onended = () => setPlayingId(null);
      audio.play();
      audioRef.current = audio;
      setPlayingId(record.id);
    }
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
                <div key={record.id} className="p-4 flex justify-between items-center hover:bg-slate-800/50 transition-colors pl-6">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => togglePlay(record)}
                      className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-blue-400 hover:bg-blue-600 hover:text-white transition-all border border-slate-700 hover:border-blue-500"
                    >
                      {playingId === record.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div>
                      <div className="text-sm font-medium text-slate-300 truncate max-w-[200px] md:max-w-md">
                        {/* Show filename or date if filename is redundant because of folder title? 
                                                Actually filename usually contains date. 
                                                Let's show simplified info.
                                            */}
                        {record.filename}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {record.station_id} • {new Date(record.created_at).toLocaleString('ja-JP')} • {
                          record.size < 1024 * 1024
                            ? `${Math.round(record.size / 1024)} KB`
                            : `${(record.size / 1024 / 1024).toFixed(1)} MB`
                        }
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <a
                      href={`/api/records/${record.filename}?download=true`}
                      download
                      className="p-2 text-slate-600 hover:text-blue-400 hover:bg-blue-950/30 rounded-lg transition-colors"
                      title="ダウンロード"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDelete(record.filename)}
                      className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
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
