'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';

type HtmlEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  lpNumber: number;
  lpName: string;
  onSaved?: () => void;
};

export default function HtmlEditModal({
  isOpen,
  onClose,
  lpNumber,
  lpName,
  onSaved,
}: HtmlEditModalProps) {
  const [html, setHtml] = useState('');
  const [originalHtml, setOriginalHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<{
    has_gtm: boolean;
    has_tracking: boolean;
  } | null>(null);

  const hasChanges = html !== originalHtml;

  // HTML取得
  const fetchHtml = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveResult(null);
    try {
      const res = await fetch(`/api/lp/${lpNumber}/html`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'HTMLの取得に失敗しました');
        return;
      }
      setHtml(data.html);
      setOriginalHtml(data.html);
    } catch {
      setError('HTMLの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [lpNumber]);

  useEffect(() => {
    if (isOpen) {
      fetchHtml();
    } else {
      setHtml('');
      setOriginalHtml('');
      setError(null);
      setSaveResult(null);
    }
  }, [isOpen, fetchHtml]);

  // 未保存変更の離脱警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
      }
    };
    if (isOpen && hasChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOpen, hasChanges]);

  const handleClose = () => {
    if (hasChanges) {
      if (!confirm('未保存の変更があります。閉じてもよろしいですか？')) {
        return;
      }
    }
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveResult(null);
    try {
      const res = await fetch(`/api/lp/${lpNumber}/html`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ html }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '保存に失敗しました');
        return;
      }
      setOriginalHtml(html);
      setSaveResult(data.checks);
      onSaved?.();
    } catch {
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center text-sm font-bold">
              {lpNumber}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">HTML編集</h2>
              <p className="text-xs text-gray-500">{lpName}</p>
            </div>
            {hasChanges && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                未保存
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {saveResult && (
              <div className="flex items-center gap-2 text-xs">
                <TagStatus label="GTM" ok={saveResult.has_gtm} />
                <TagStatus label="Track" ok={saveResult.has_tracking} />
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges || loading}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${saving || !hasChanges || loading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-rose-600 text-white hover:bg-rose-700'
                }
              `}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* エディタ */}
        <div className="flex-1 p-6 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              HTML読み込み中...
            </div>
          ) : (
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              className="w-full h-full font-mono text-sm leading-relaxed p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none bg-gray-50"
              placeholder="HTMLコンテンツ"
              spellCheck={false}
            />
          )}
        </div>

        {/* フッター情報 */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <span>
            保存後、配信URLに反映されるまで最大1分（キャッシュ）かかります
          </span>
          <span>
            {html.length.toLocaleString()} 文字
          </span>
        </div>
      </div>
    </div>
  );
}

function TagStatus({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
        ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
      `}
    >
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}
