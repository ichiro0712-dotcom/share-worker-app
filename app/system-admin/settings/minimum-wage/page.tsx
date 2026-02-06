'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save,
  Upload,
  Download,
  History,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { PREFECTURES } from '@/constants/prefectureCities';

interface MinimumWageData {
  id: number;
  prefecture: string;
  hourlyWage: number;
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
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
  // データ
  const [wages, setWages] = useState<MinimumWageData[]>([]);
  const [missingPrefectures, setMissingPrefectures] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryData[]>([]);

  // UI状態
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 編集中の行
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingWage, setEditingWage] = useState<string>('');
  const [editingEffectiveFrom, setEditingEffectiveFrom] = useState<string>('');

  // CSVインポート
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importEffectiveFrom, setImportEffectiveFrom] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<CsvError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 履歴表示
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // データ取得
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/system-admin/minimum-wage');
      if (res.ok) {
        const data = await res.json();
        setWages(data.wages || []);
        setMissingPrefectures(data.missingPrefectures || []);
      }
    } catch (error) {
      console.error('データ取得エラー:', error);
      setMessage({ type: 'error', text: 'データの取得に失敗しました' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 履歴取得
  const fetchHistory = async () => {
    if (history.length > 0) return; // 既に取得済み
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/system-admin/minimum-wage/history');
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

  // 編集開始
  const startEdit = (wage: MinimumWageData) => {
    setEditingId(wage.id);
    setEditingWage(wage.hourlyWage.toString());
    setEditingEffectiveFrom(wage.effectiveFrom.split('T')[0]);
  };

  // 編集キャンセル
  const cancelEdit = () => {
    setEditingId(null);
    setEditingWage('');
    setEditingEffectiveFrom('');
  };

  // 保存
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

      if (res.ok) {
        setMessage({ type: 'success', text: `${prefecture}の最低賃金を更新しました` });
        cancelEdit();
        fetchData();
        // 履歴も更新
        setHistory([]);
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || '更新に失敗しました' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '更新に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  // CSVインポート
  const handleImport = async () => {
    if (!importFile || !importEffectiveFrom) {
      setMessage({ type: 'error', text: 'ファイルと適用開始日を選択してください' });
      return;
    }

    setImporting(true);
    setImportErrors([]);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('effectiveFrom', importEffectiveFrom);

      const res = await fetch('/api/system-admin/minimum-wage/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: `${data.imported}件の最低賃金をインポートしました`,
        });
        setShowImportModal(false);
        setImportFile(null);
        setImportEffectiveFrom('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        fetchData();
        // 履歴も更新
        setHistory([]);
      } else {
        setImportErrors(data.errors || []);
        if (data.errors?.length === 0) {
          setMessage({ type: 'error', text: 'インポートに失敗しました' });
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'インポートに失敗しました' });
    } finally {
      setImporting(false);
    }
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

  // 都道府県ごとのデータをマップ化
  const wageMap = new Map(wages.map(w => [w.prefecture, w]));

  return (
    <div className="p-6 max-w-6xl">
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
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                都道府県
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                時給（円）
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                適用開始日
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {PREFECTURES.map(pref => {
              const wage = wageMap.get(pref);
              const isEditing = wage && editingId === wage.id;

              return (
                <tr key={pref} className={!wage ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-3 text-sm">{pref}</td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editingWage}
                        onChange={e => setEditingWage(e.target.value)}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                        min="1"
                      />
                    ) : wage ? (
                      <span className="font-mono">¥{wage.hourlyWage.toLocaleString()}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <input
                        type="date"
                        value={editingEffectiveFrom}
                        onChange={e => setEditingEffectiveFrom(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : wage ? (
                      <span className="text-sm text-gray-600">
                        {new Date(wage.effectiveFrom).toLocaleDateString('ja-JP')}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => saveEdit(pref)}
                          disabled={saving}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : wage ? (
                      <button
                        onClick={() => startEdit(wage)}
                        className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                      >
                        編集
                      </button>
                    ) : (
                      <span className="text-sm text-gray-400">CSVで登録</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
                          {new Date(h.effectiveFrom).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {h.effectiveTo
                            ? new Date(h.effectiveTo).toLocaleDateString('ja-JP')
                            : '-'}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {new Date(h.archivedAt).toLocaleDateString('ja-JP')}
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
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* ファイル選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CSVファイル
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="mt-1 text-xs text-gray-500">
                  形式: 都道府県,時給（例: 東京都,1163 または 東京,1163）
                </p>
              </div>

              {/* 適用開始日 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  適用開始日
                </label>
                <input
                  type="date"
                  value={importEffectiveFrom}
                  onChange={e => setImportEffectiveFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="mt-1 text-xs text-gray-500">
                  この日付から新しい最低賃金が適用されます
                </p>
              </div>

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
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !importFile || !importEffectiveFrom}
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
