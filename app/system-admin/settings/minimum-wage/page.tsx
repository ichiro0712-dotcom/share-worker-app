'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  Upload,
  Download,
  FileDown,
  History,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  X,
  Trash2,
} from 'lucide-react';
import { PREFECTURES } from '@/constants/prefectureCities';
import { parseMinimumWageCsv, decodeCsvBuffer } from '@/src/lib/prefecture-utils';

interface MinimumWageData {
  id: number;
  prefecture: string;
  hourlyWage: number;
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
  status?: 'active' | 'scheduled';
}

interface AdminMinimumWageView {
  prefecture: string;
  active: MinimumWageData | null;
  scheduled: MinimumWageData | null;
}

interface HistoryData {
  id: number;
  prefecture: string;
  hourlyWage: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  archivedAt: string;
}

interface CsvError {
  line: number;
  content: string;
  reason: string;
}

export default function MinimumWagePage() {
  const router = useRouter();

  // データ
  const [prefectureViews, setPrefectureViews] = useState<AdminMinimumWageView[]>([]);
  const [missingPrefectures, setMissingPrefectures] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryData[]>([]);

  // UI状態
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 編集中の行（現行の即時編集）
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingPrefecture, setEditingPrefecture] = useState<string>('');
  const [editingWage, setEditingWage] = useState<string>('');
  const [editingEffectiveFrom, setEditingEffectiveFrom] = useState<string>('');

  // 予定登録/編集
  const [schedulingPrefecture, setSchedulingPrefecture] = useState<string | null>(null);
  const [scheduleWage, setScheduleWage] = useState<string>('');
  const [scheduleEffectiveFrom, setScheduleEffectiveFrom] = useState<string>('');
  const [schedulingExistingId, setSchedulingExistingId] = useState<number | null>(null);

  // CSVインポート
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importEffectiveFrom, setImportEffectiveFrom] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<CsvError[]>([]);
  const [previewData, setPreviewData] = useState<{ prefecture: string; hourlyWage: number; effectiveFrom?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 履歴表示
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // データ取得
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/system-admin/minimum-wage');
      if (res.status === 401) {
        router.push('/system-admin/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setPrefectureViews(data.prefectures || []);
        setMissingPrefectures(data.missingPrefectures || []);
      } else {
        setMessage({ type: 'error', text: 'データの取得に失敗しました' });
      }
    } catch (error) {
      console.error('データ取得エラー:', error);
      setMessage({ type: 'error', text: 'データの取得に失敗しました' });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 履歴取得
  const fetchHistory = async () => {
    if (history.length > 0) return;
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/system-admin/minimum-wage/history');
      if (res.status === 401) {
        router.push('/system-admin/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('履歴取得エラー:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 現行の編集開始
  const startEdit = (wage: MinimumWageData) => {
    setEditingId(wage.id);
    setEditingPrefecture(wage.prefecture);
    setEditingWage(wage.hourlyWage.toString());
    setEditingEffectiveFrom(wage.effectiveFrom.split('T')[0]);
  };

  // 編集キャンセル
  const cancelEdit = () => {
    setEditingId(null);
    setEditingPrefecture('');
    setEditingWage('');
    setEditingEffectiveFrom('');
  };

  // 現行の保存
  const saveEdit = async (prefecture: string) => {
    const hourlyWage = parseInt(editingWage, 10);
    if (isNaN(hourlyWage) || hourlyWage <= 0) {
      setMessage({ type: 'error', text: '時給は正の数で入力してください' });
      return;
    }

    if (!editingEffectiveFrom) {
      setMessage({ type: 'error', text: '適用開始日を入力してください' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/system-admin/minimum-wage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefecture,
          hourlyWage,
          effectiveFrom: editingEffectiveFrom,
        }),
      });

      if (res.status === 401) {
        router.push('/system-admin/login');
        return;
      }
      if (res.ok) {
        setMessage({ type: 'success', text: `${prefecture}の最低賃金を更新しました` });
        cancelEdit();
        fetchData();
        setHistory([]);
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || '更新に失敗しました' });
      }
    } catch {
      setMessage({ type: 'error', text: '更新に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  // 予定登録開始
  const startSchedule = (prefecture: string, existingScheduled?: MinimumWageData | null) => {
    setSchedulingPrefecture(prefecture);
    if (existingScheduled) {
      setScheduleWage(existingScheduled.hourlyWage.toString());
      setScheduleEffectiveFrom(existingScheduled.effectiveFrom.split('T')[0]);
      setSchedulingExistingId(existingScheduled.id);
    } else {
      setScheduleWage('');
      setScheduleEffectiveFrom('');
      setSchedulingExistingId(null);
    }
  };

  // 予定登録キャンセル
  const cancelSchedule = () => {
    setSchedulingPrefecture(null);
    setScheduleWage('');
    setScheduleEffectiveFrom('');
    setSchedulingExistingId(null);
  };

  // 予定保存
  const saveSchedule = async () => {
    if (!schedulingPrefecture) return;

    const hourlyWage = parseInt(scheduleWage, 10);
    if (isNaN(hourlyWage) || hourlyWage <= 0) {
      setMessage({ type: 'error', text: '時給は正の数で入力してください' });
      return;
    }

    if (!scheduleEffectiveFrom) {
      setMessage({ type: 'error', text: '適用予定日を入力してください' });
      return;
    }

    // 未来日付チェック
    const selectedDate = new Date(scheduleEffectiveFrom);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate <= today) {
      setMessage({ type: 'error', text: '予定の適用開始日は明日以降の日付を選択してください' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/system-admin/minimum-wage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefecture: schedulingPrefecture,
          hourlyWage,
          effectiveFrom: scheduleEffectiveFrom,
        }),
      });

      if (res.status === 401) {
        router.push('/system-admin/login');
        return;
      }
      if (res.ok) {
        const action = schedulingExistingId ? '更新' : '登録';
        setMessage({ type: 'success', text: `${schedulingPrefecture}の予定を${action}しました` });
        cancelSchedule();
        fetchData();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || '予定の登録に失敗しました' });
      }
    } catch {
      setMessage({ type: 'error', text: '予定の登録に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  // 予定取消
  const deleteSchedule = async (id: number, prefecture: string) => {
    if (!window.confirm(`${prefecture}の予定を取り消しますか？`)) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/system-admin/minimum-wage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.status === 401) {
        router.push('/system-admin/login');
        return;
      }
      if (res.ok) {
        setMessage({ type: 'success', text: `${prefecture}の予定を取り消しました` });
        fetchData();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || '取消に失敗しました' });
      }
    } catch {
      setMessage({ type: 'error', text: '取消に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  // CSVファイル選択時にプレビュー表示
  const handleFileSelect = async (file: File | null) => {
    setImportFile(file);
    setPreviewData([]);
    setImportErrors([]);

    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const text = decodeCsvBuffer(buffer);
      const { data, errors } = parseMinimumWageCsv(text);
      setPreviewData(data);
      setImportErrors(errors.map((e: { line: number; content: string; reason: string }) => ({ line: e.line, content: e.content, reason: e.reason })));
    } catch {
      setImportErrors([{ line: 0, content: '', reason: 'ファイルの読み込みに失敗しました' }]);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      setMessage({ type: 'error', text: 'ファイルを選択してください' });
      return;
    }

    let effectiveDate = importEffectiveFrom;
    if (!effectiveDate) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
      const confirmed = window.confirm(
        `適用開始日が未入力です。\n本日（${todayStr}）から即反映しますか？`
      );
      if (!confirmed) return;
      effectiveDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    setImporting(true);
    setImportErrors([]);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('effectiveFrom', effectiveDate);

      const res = await fetch('/api/system-admin/minimum-wage/import', {
        method: 'POST',
        body: formData,
      });

      if (res.status === 401) {
        router.push('/system-admin/login');
        return;
      }

      const data = await res.json();

      if (data.success) {
        const isScheduled = new Date(effectiveDate) > new Date();
        const label = isScheduled ? '予定として' : '';
        setMessage({
          type: 'success',
          text: `${data.imported}件の最低賃金を${label}インポートしました`,
        });
        setShowImportModal(false);
        setImportFile(null);
        setImportEffectiveFrom('');
        setPreviewData([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        fetchData();
        setHistory([]);
      } else {
        setImportErrors(data.errors || []);
        if (data.errors?.length === 0) {
          setMessage({ type: 'error', text: 'インポートに失敗しました' });
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'インポートに失敗しました' });
    } finally {
      setImporting(false);
    }
  };

  // CSVテンプレートダウンロード
  const handleDownloadTemplate = () => {
    // 次の10月1日をサンプル日付として計算
    const now = new Date();
    const year = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear(); // 10月以降なら翌年
    const sampleDate = `${year}-10-01`;

    const bom = '\uFEFF';
    const header = '都道府県,時給,適用開始日';
    const rows = PREFECTURES.map(pref => `${pref},,${sampleDate}`);
    const csv = bom + [header, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '最低賃金_テンプレート.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // CSVエクスポート
  const handleExport = () => {
    const link = document.createElement('a');
    link.href = '/api/system-admin/minimum-wage/export';
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 履歴CSVエクスポート
  const handleHistoryExport = () => {
    const link = document.createElement('a');
    link.href = '/api/system-admin/minimum-wage/history/export';
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ja-JP');
  };

  // インポート時の予定/即時判定
  const isImportScheduled = importEffectiveFrom
    ? new Date(importEffectiveFrom) > new Date()
    : false;

  // ローディング表示
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">最低賃金設定</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            CSVインポート
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSVエクスポート
          </button>
        </div>
      </div>

      {/* メッセージ */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* 未登録の都道府県警告 */}
      {missingPrefectures.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-700 font-medium mb-2">
            <AlertCircle className="w-5 h-5" />
            未登録の都道府県があります（{missingPrefectures.length}件）
          </div>
          <div className="text-sm text-yellow-600">
            {missingPrefectures.join('、')}
          </div>
        </div>
      )}

      {/* 最低賃金一覧テーブル */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-[120px]">
                  都道府県
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 w-[120px]">
                  現行時給
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-[130px]">
                  適用実施日
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 w-[120px]">
                  <span className="flex items-center justify-end gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    予定時給
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-[130px]">
                  予定開始日
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-[200px]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {prefectureViews.map(view => {
                const { prefecture, active, scheduled } = view;
                const isEditingActive = active && editingId === active.id;
                const isScheduling = schedulingPrefecture === prefecture;
                const hasSchedule = !!scheduled;

                return (
                  <tr
                    key={prefecture}
                    className={`${!active ? 'bg-yellow-50' : ''} ${hasSchedule ? 'border-l-4 border-l-blue-300' : 'border-l-4 border-l-transparent'}`}
                  >
                    {/* 都道府県 */}
                    <td className="px-4 py-3 text-sm font-medium">{prefecture}</td>

                    {/* 現行時給 */}
                    <td className="px-4 py-3 text-right">
                      {isEditingActive ? (
                        <input
                          type="number"
                          value={editingWage}
                          onChange={e => setEditingWage(e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                          min="1"
                        />
                      ) : active ? (
                        <span className="font-mono">¥{active.hourlyWage.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* 適用日（読み取り専用） */}
                    <td className="px-4 py-3 text-center">
                      {active ? (
                        <span className="text-sm text-gray-600">
                          {formatDate(active.effectiveFrom)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* 予定時給 */}
                    <td className="px-4 py-3 text-right">
                      {isScheduling ? (
                        <input
                          type="number"
                          value={scheduleWage}
                          onChange={e => setScheduleWage(e.target.value)}
                          className="w-24 px-2 py-1 border border-blue-300 rounded text-right bg-blue-50"
                          min="1"
                        />
                      ) : scheduled ? (
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="font-mono text-blue-700">¥{scheduled.hourlyWage.toLocaleString()}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-600">
                            予定
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* 予定開始日 */}
                    <td className="px-4 py-3 text-center">
                      {isScheduling ? (
                        <input
                          type="date"
                          value={scheduleEffectiveFrom}
                          onChange={e => setScheduleEffectiveFrom(e.target.value)}
                          className="px-2 py-1 border border-blue-300 rounded text-sm bg-blue-50"
                        />
                      ) : scheduled ? (
                        <span className="text-sm text-blue-600">
                          {formatDate(scheduled.effectiveFrom)}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-3 text-center">
                      {isEditingActive ? (
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => saveEdit(prefecture)}
                            disabled={saving}
                            className="px-2.5 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-2.5 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : isScheduling ? (
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={saveSchedule}
                            disabled={saving}
                            className="px-2.5 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelSchedule}
                            className="px-2.5 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-1.5 flex-wrap">
                          {active && (
                            <button
                              onClick={() => startEdit(active)}
                              className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
                            >
                              編集
                            </button>
                          )}
                          {scheduled ? (
                            <>
                              <button
                                onClick={() => startSchedule(prefecture, scheduled)}
                                className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded hover:bg-blue-100"
                              >
                                予定編集
                              </button>
                              <button
                                onClick={() => deleteSchedule(scheduled.id, prefecture)}
                                className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded hover:bg-red-100"
                                title="予定を取消"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startSchedule(prefecture)}
                              className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded hover:bg-blue-100"
                            >
                              予定登録
                            </button>
                          )}
                          {!active && !scheduled && (
                            <span className="text-xs text-gray-400">CSVで登録</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 履歴セクション */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => {
            setShowHistory(!showHistory);
            if (!showHistory) fetchHistory();
          }}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2 font-medium">
            <History className="w-5 h-5 text-gray-600" />
            更新履歴
          </div>
          {showHistory ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </button>

        {showHistory && (
          <div className="p-4">
            {loadingHistory ? (
              <div className="text-center py-8 text-gray-500">読み込み中...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                履歴データがありません
              </div>
            ) : (
              <>
                <div className="flex justify-end mb-4">
                  <button
                    onClick={handleHistoryExport}
                    className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    <Download className="w-4 h-4" />
                    履歴をCSVエクスポート
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">都道府県</th>
                      <th className="px-3 py-2 text-right">時給</th>
                      <th className="px-3 py-2 text-center">適用開始日</th>
                      <th className="px-3 py-2 text-center">適用終了日</th>
                      <th className="px-3 py-2 text-center">アーカイブ日時</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {history.slice(0, 50).map(h => (
                      <tr key={h.id}>
                        <td className="px-3 py-2">{h.prefecture}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          ¥{h.hourlyWage.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {formatDate(h.effectiveFrom)}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {h.effectiveTo
                            ? formatDate(h.effectiveTo)
                            : '-'}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {formatDate(h.archivedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {history.length > 50 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    他 {history.length - 50} 件（CSVエクスポートで全件取得可能）
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* CSVインポートモーダル */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold">CSVインポート</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportErrors([]);
                  setPreviewData([]);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* テンプレートダウンロード */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">CSVフォーマットがわからない場合</p>
                    <p className="text-xs text-gray-500 mt-0.5">47都道府県が入ったテンプレートをダウンロードして、時給と適用開始日を入力してください</p>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    <FileDown className="w-4 h-4" />
                    テンプレート
                  </button>
                </div>
              </div>

              {/* ファイル選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CSVファイル
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={e => handleFileSelect(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="mt-1 text-xs text-gray-500">
                  形式: 都道府県,時給,適用開始日（例: 東京都,1163,2026-10-01）※3列目は省略可
                </p>
              </div>

              {/* 適用開始日（デフォルト） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  適用開始日（デフォルト）
                </label>
                <input
                  type="date"
                  value={importEffectiveFrom}
                  onChange={e => setImportEffectiveFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="mt-1 text-xs text-gray-500">
                  CSVで個別に日付指定がない行に適用されます。未入力の場合は即反映確認
                </p>
                {importEffectiveFrom && (
                  <div className={`mt-2 px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 ${
                    isImportScheduled
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {isImportScheduled ? (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        予定として登録されます。現在の賃金は変更されません。
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" />
                        即時適用されます。現在の賃金は履歴に保存されます。
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* プレビュー */}
              {previewData.length > 0 && (
                <div className="border border-green-200 rounded-lg overflow-hidden">
                  <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                    <p className="text-sm font-medium text-green-800">
                      プレビュー（{previewData.length}件）
                    </p>
                  </div>
                  <div className="max-h-48 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500">都道府県</th>
                          <th className="px-4 py-1.5 text-right text-xs font-medium text-gray-500">時給</th>
                          <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500">適用開始日</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewData.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-1 text-gray-700">{row.prefecture}</td>
                            <td className="px-4 py-1 text-right text-gray-900 font-medium">
                              {row.hourlyWage.toLocaleString()}円
                            </td>
                            <td className="px-4 py-1 text-gray-600 text-xs">
                              {row.effectiveFrom || (
                                <span className="text-gray-400">デフォルト{importEffectiveFrom ? `(${importEffectiveFrom})` : ''}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* エラー表示 */}
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-red-700 mb-2">
                    以下の行でエラーが発生しました:
                  </div>
                  <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-auto">
                    {importErrors.map((err, i) => (
                      <li key={i}>
                        行{err.line}: {err.reason}
                        {err.content && (
                          <span className="text-gray-500 ml-1">({err.content})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 注意事項 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">
                  インポート時の注意
                </h3>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• CSVの3列目に適用開始日（YYYY-MM-DD）を都道府県ごとに指定できます</li>
                  <li>• 3列目が空欄の行は、上で設定したデフォルト適用開始日が使われます</li>
                  <li>• 適用開始日が未来の場合、予定データとして登録されます（現在の賃金は変更されません）</li>
                  <li>• 既存のデータは履歴として自動バックアップされます</li>
                  <li>• 都道府県名は「東京都」「東京」どちらでも認識されます</li>
                  <li>• 時給は「1163」「1,163」どちらでも認識されます</li>
                  <li>• ヘッダー行は自動的にスキップされます</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportErrors([]);
                  setPreviewData([]);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !importFile || previewData.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'インポート中...' : 'インポート実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
