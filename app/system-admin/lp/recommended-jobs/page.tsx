'use client';

import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Loader2, AlertTriangle, ExternalLink, Eye } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface RegisteredJob {
  jobId: number;
  title: string;
  status: string;
  facilityName: string;
  futureWorkDateCount: number;
  remainingDays: number | null;
}

const MAX_JOBS = 20;

export default function RecommendedJobsPage() {
  const [registeredJobs, setRegisteredJobs] = useState<RegisteredJob[]>([]);
  const [originalJobIds, setOriginalJobIds] = useState<number[]>([]);
  const [jobIdInput, setJobIdInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // D&D state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);

  useEffect(() => {
    fetchRegisteredJobs();
  }, []);

  const fetchRegisteredJobs = async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/system-admin/recommended-jobs');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setLoadError('認証が切れています。System Admin管理画面に再ログインしてください。');
        } else {
          setLoadError(errData.error || `読み込みに失敗しました (${res.status})`);
        }
        return;
      }
      const data = await res.json();
      const jobs: RegisteredJob[] = (data.jobs || []).map((r: {
        job: { id: number; title: string; status: string; facility: { name: string } };
        futureWorkDateCount: number;
        remainingDays: number | null;
      }) => ({
        jobId: r.job.id,
        title: r.job.title,
        status: r.job.status,
        facilityName: r.job.facility.name,
        futureWorkDateCount: r.futureWorkDateCount,
        remainingDays: r.remainingDays,
      }));
      setRegisteredJobs(jobs);
      setOriginalJobIds(jobs.map(j => j.jobId));
    } catch {
      setLoadError('通信エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = JSON.stringify(registeredJobs.map(j => j.jobId)) !== JSON.stringify(originalJobIds);

  // 求人番号で追加
  const handleAdd = async () => {
    const id = parseInt(jobIdInput.trim(), 10);
    if (isNaN(id) || id <= 0) {
      setAddError('有効な求人番号を入力してください');
      return;
    }
    if (registeredJobs.some(j => j.jobId === id)) {
      setAddError('既にリストに追加済みです');
      return;
    }
    if (registeredJobs.length >= MAX_JOBS) {
      setAddError(`最大${MAX_JOBS}件までです`);
      return;
    }

    setIsAdding(true);
    setAddError('');
    try {
      const res = await fetch(`/api/system-admin/recommended-jobs?jobId=${id}`);
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || '取得に失敗しました');
        return;
      }
      setRegisteredJobs(prev => [...prev, {
        jobId: data.job.id,
        title: data.job.title,
        status: data.job.status,
        facilityName: data.job.facility.name,
        futureWorkDateCount: 0, // 新規追加時は一覧リロードで更新
        remainingDays: null,
      }]);
      setJobIdInput('');
    } catch {
      setAddError('通信エラーが発生しました');
    } finally {
      setIsAdding(false);
    }
  };

  const removeJob = (jobId: number) => {
    setRegisteredJobs(prev => prev.filter(j => j.jobId !== jobId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/system-admin/recommended-jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: registeredJobs.map(j => j.jobId) }),
      });
      if (res.ok) {
        setSaveMessage({ type: 'success', text: '保存しました' });
        setTimeout(() => setSaveMessage(null), 3000);
        // 保存後にリロードして残り日数を更新
        await fetchRegisteredJobs();
      } else {
        const data = await res.json();
        setSaveMessage({ type: 'error', text: data.error || '保存に失敗しました' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: '保存に失敗しました' });
    } finally {
      setIsSaving(false);
    }
  };

  // D&D handlers
  const handleDragStart = (index: number) => {
    dragItem.current = index;
    setDragIndex(index);
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = (index: number) => {
    if (dragItem.current === null) return;
    const from = dragItem.current;
    if (from === index) return;
    setRegisteredJobs(prev => {
      const newList = [...prev];
      const [moved] = newList.splice(from, 1);
      newList.splice(index, 0, moved);
      return newList;
    });
    dragItem.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    dragItem.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // 残り日数の警告レベル
  const getWarningLevel = (job: RegisteredJob): 'danger' | 'warning' | 'none' => {
    if (job.remainingDays === null || job.futureWorkDateCount === 0) return 'danger';
    if (job.remainingDays < 3) return 'warning';
    return 'none';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href="/system-admin/lp"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            LP管理に戻る
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">おすすめ求人管理</h1>
          <p className="text-sm text-slate-500 mt-1">
            全LP共通・最大{MAX_JOBS}件。LPのHTMLに <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">&lt;div data-tastas-jobs&gt;&lt;/div&gt;</code> を記述すると表示されます。
          </p>
        </div>

        {/* 求人番号で追加 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">求人を追加</h2>
          <div className="flex gap-2">
            <input
              type="number"
              value={jobIdInput}
              onChange={(e) => { setJobIdInput(e.target.value); setAddError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="求人番号を入力"
              className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              onClick={handleAdd}
              disabled={isAdding || !jobIdInput.trim()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              追加
            </button>
          </div>
          {addError && (
            <p className="text-xs text-red-500 mt-2">{addError}</p>
          )}
        </div>

        {/* 登録済み求人 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              登録済み求人（{registeredJobs.length}/{MAX_JOBS}）
            </h2>
            {hasChanges && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                未保存の変更があります
              </span>
            )}
          </div>

          {loadError && (
            <div className="py-4 px-4 mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {loadError}
            </div>
          )}

          {registeredJobs.length === 0 && !loadError ? (
            <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
              <p className="text-sm">まだ求人が登録されていません</p>
              <p className="text-xs mt-1">上から求人番号を入力して追加してください</p>
            </div>
          ) : (
            <div className="space-y-1">
              {registeredJobs.map((job, index) => {
                const warning = getWarningLevel(job);
                return (
                  <div
                    key={job.jobId}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors cursor-grab active:cursor-grabbing ${
                      dragIndex === index
                        ? 'opacity-50 border-indigo-300 bg-indigo-50'
                        : dragOverIndex === index
                          ? 'border-indigo-400 bg-indigo-50'
                          : warning === 'danger'
                            ? 'border-red-200 bg-red-50'
                            : warning === 'warning'
                              ? 'border-amber-200 bg-amber-50'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    <span className="text-xs text-slate-400 w-5 flex-shrink-0">{index + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-slate-400">#{job.jobId}</span>
                        <span className="text-sm text-slate-900 truncate">{job.title}</span>
                        <span className="text-xs text-slate-500">/ {job.facilityName}</span>
                      </div>
                      {/* 残り日数の警告 */}
                      {warning !== 'none' && (
                        <div className={`flex items-center gap-1 mt-0.5 ${warning === 'danger' ? 'text-red-600' : 'text-amber-600'}`}>
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          <span className="text-[11px] font-medium">
                            {job.remainingDays === null || job.futureWorkDateCount === 0
                              ? '勤務日なし（掲載終了の可能性）'
                              : `最短の勤務日まで残り${job.remainingDays}日`
                            }
                          </span>
                        </div>
                      )}
                    </div>
                    <a
                      href={`/jobs/${job.jobId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors flex-shrink-0"
                      title="求人詳細を開く"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => removeJob(job.jobId)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-3">
            ドラッグ&ドロップで表示順を変更できます
          </p>

          {/* 保存ボタン */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存する
            </button>
            <Link
              href="/system-admin/lp/recommended-jobs/preview"
              className="px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              プレビュー
            </Link>
            {saveMessage && (
              <span className={`text-sm ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {saveMessage.text}
              </span>
            )}
          </div>
        </div>

        {/* 表示仕様 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">表示仕様</h2>
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <h3 className="font-medium text-slate-800 mb-1">基本動作</h3>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>登録した求人はLP内の <code className="bg-slate-100 px-1 rounded text-xs">&lt;div data-tastas-jobs&gt;&lt;/div&gt;</code> の位置にiframeで表示されます</li>
                <li>日付選択UI付き（デフォルトは3日後）で、選択日に勤務可能な求人のみ表示されます</li>
                <li>公開中（PUBLISHED）の求人のみ表示されます。下書きや非公開の求人は表示されません</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-slate-800 mb-1">通常の求人</h3>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>クリックすると求人詳細ページ（<code className="bg-slate-100 px-1 rounded text-xs">/public/jobs/[id]</code>）に遷移します</li>
                <li>選択中の日付とLP番号がURLパラメータとして引き継がれます</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-slate-800 mb-1">求人の募集枠が埋まった場合</h3>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>募集枠が満員の求人もそのまま表示されます（非表示にはなりません）</li>
                <li>募集人数の表示欄は非表示になります（内部数値は公開されません）</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-slate-800 mb-1">今日以降の勤務日がない求人</h3>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>全日程で常に表示されます（日付選択でフィルタされません）</li>
                <li>クリックすると、そのLPに設定されたCTA URL（LINE登録URL等）に直接遷移します</li>
                <li>遷移時にLPトラッキング（CTAクリック）が自動送信されます</li>
                <li>管理画面のリスト上では <span className="text-red-600 font-medium">赤い警告</span>（「勤務日なし」）が表示されます</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-slate-800 mb-1">残り日数の警告</h3>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><span className="text-red-600 font-medium">赤</span>: 今日以降の勤務日がない（掲載終了の可能性）</li>
                <li><span className="text-amber-600 font-medium">黄</span>: 最短の勤務日まで残り3日未満</li>
                <li>警告なし: 余裕あり</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
