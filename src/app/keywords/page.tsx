'use client';

import { useState, useEffect } from 'react';
import { Tag, Trash2, Plus, Play, Search, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SearchResultModal } from '@/components/SearchResultModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Keyword {
    id: number;
    keyword: string;
    enabled: number; // 0 or 1
    created_at: string;
}

export default function KeywordsPage() {
    const [keywords, setKeywords] = useState<Keyword[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [stations, setStations] = useState<{ id: string, name: string }[]>([]);
    const router = useRouter();

    // プレビューロジック
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewKeyword, setPreviewKeyword] = useState('');
    const [previewResults, setPreviewResults] = useState<any[]>([]);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    useEffect(() => {
        fetchKeywords();
        fetchStations();
    }, []);

    const fetchStations = async () => {
        try {
            const res = await fetch('/api/stations');
            const data = await res.json();
            setStations(data);
        } catch (error) {
            console.error('Failed to fetch stations', error);
        }
    };

    const fetchKeywords = async () => {
        try {
            const res = await fetch('/api/keywords');
            const data = await res.json();
            setKeywords(data);
        } catch (error) {
            console.error('Failed to fetch keywords', error);
        } finally {
            setIsLoading(false);
        }
    };

    const addKeyword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyword.trim()) return;

        try {
            const res = await fetch('/api/keywords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword: newKeyword.trim() })
            });
            if (res.ok) {
                setNewKeyword('');
                fetchKeywords();
            }
        } catch (error) {
            alert('キーワードの追加に失敗しました');
        }
    };

    const toggleKeyword = async (id: number, currentEnabled: number) => {
        const newEnabled = currentEnabled ? 0 : 1;
        // 楽観的更新
        setKeywords(prev => prev.map(k => k.id === id ? { ...k, enabled: newEnabled } : k));

        try {
            await fetch(`/api/keywords/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newEnabled })
            });
        } catch (error) {
            fetchKeywords(); // Revert
        }
    };

    // 確認ダイアログの状態
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    const handleDeleteClick = (id: number) => {
        setDeleteTargetId(id);
        setIsDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;
        const id = deleteTargetId;

        // 楽観的削除
        setKeywords(prev => prev.filter(k => k.id !== id));

        try {
            await fetch(`/api/keywords/${id}`, { method: 'DELETE' });
        } catch (error) {
            fetchKeywords(); // Revert on failure
        }
    };

    const handleScan = async () => {
        if (isScanning) return;
        setIsScanning(true);
        try {
            const res = await fetch('/api/keywords/scan', { method: 'POST' });
            if (res.ok) {
                alert('スキャンが完了しました。予約リストを確認してください。');
                router.push('/schedules');
            } else {
                alert('スキャンに失敗しました');
            }
        } catch (error) {
            alert('エラーが発生しました');
        } finally {
            setIsScanning(false);
        }
    };

    const handlePreview = async (keyword: string) => {
        setPreviewKeyword(keyword);
        setIsPreviewLoading(true);
        try {
            const res = await fetch('/api/keywords/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword })
            });
            const data = await res.json();
            if (data.programs) {
                setPreviewResults(data.programs);
                setIsPreviewOpen(true);
            } else {
                alert('検索に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleReserveSelected = async (selectedPrograms: any[]) => {
        try {
            const schedules = selectedPrograms.map(p => {
                const start = new Date(p.start_time);
                const end = new Date(p.end_time);
                const duration = Math.round((end.getTime() - start.getTime()) / 60000);
                // JST文字列ハック (API用)
                const startTimeStr = p.start_time.replace(' ', 'T').substring(0, 16);

                return {
                    station_id: p.station_id,
                    start_time: startTimeStr,
                    duration,
                    title: p.title
                };
            });

            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(schedules)
            });

            if (res.ok) {
                alert(`${selectedPrograms.length} 件の予約を追加しました`);
            } else {
                alert('予約の追加に失敗しました');
            }
        } catch (e) {
            alert('エラーが発生しました');
        }
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500">読み込み中...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Search className="w-8 h-8 text-radiko-blue" />
                    キーワード管理
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    「自動予約」をONにすると、毎朝4時に自動で予約されます。<br />
                    OFFの場合は自動予約されず、手動検索用として利用できます。
                </p>
            </div>

            {/* Add Form */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <form onSubmit={addKeyword} className="flex gap-3">
                    <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            placeholder="番組名、出演者名など..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-radiko-blue focus:ring-0 outline-none transition-all placeholder:text-slate-400 font-bold text-slate-700"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!newKeyword.trim()}
                        className="px-6 bg-radiko-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="hidden sm:inline">追加</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePreview(newKeyword)}
                        disabled={isPreviewLoading || !newKeyword.trim()}
                        className="flex items-center gap-2 px-6 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                    >
                        {isPreviewLoading && previewKeyword === newKeyword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        <span className="hidden sm:inline">検索</span>
                    </button>
                </form>
            </div>

            {/* List */}
            <div className="space-y-3">
                {keywords.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>キーワード登録されていません</p>
                    </div>
                ) : (
                    keywords.map((keyword) => (
                        <div
                            key={keyword.id}
                            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${keyword.enabled
                                ? 'bg-white border-slate-100 shadow-sm'
                                : 'bg-slate-50 border-transparent opacity-60'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${keyword.enabled ? 'bg-blue-50 text-radiko-blue' : 'bg-slate-200 text-slate-400'}`}>
                                    <Tag className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">{keyword.keyword}</h3>
                                    <p className="text-xs text-slate-400">
                                        {new Date(keyword.created_at).toLocaleDateString()} 追加
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePreview(keyword.keyword)}
                                    disabled={isPreviewLoading}
                                    className="px-3 py-1.5 bg-blue-50 text-radiko-blue rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1"
                                >
                                    {isPreviewLoading && previewKeyword === keyword.keyword ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                    確認
                                </button>
                                <button
                                    onClick={() => toggleKeyword(keyword.id, keyword.enabled)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${keyword.enabled
                                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                        : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                        }`}
                                >
                                    {keyword.enabled ? '自動予約: ON' : '自動予約: OFF'}
                                </button>
                                <button
                                    onClick={() => handleDeleteClick(keyword.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <SearchResultModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                keyword={previewKeyword}
                results={previewResults}
                stations={stations}
                onReserve={handleReserveSelected}
            />

            <ConfirmDialog
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={confirmDelete}
                title="キーワードの削除"
                message="このキーワードを削除してもよろしいですか？今後の自動予約は行われなくなります。"
                confirmText="削除"
                cancelText="キャンセル"
                isDestructive={true}
            />
        </div>
    );
}
