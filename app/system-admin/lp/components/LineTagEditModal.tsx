'use client';

import { useState, useEffect } from 'react';

type LineTag = {
  id: number;
  key: string;
  label: string;
  url: string;
  is_default: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function LineTagEditModal({ isOpen, onClose }: Props) {
  const [tags, setTags] = useState<LineTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTags();
    }
  }, [isOpen]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lp-line-tags');
      const data = await res.json();
      if (data.tags) {
        setTags(data.tags);
      }
    } catch (error) {
      console.error('Failed to fetch line tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim() || !newLabel.trim() || !newUrl.trim()) {
      setError('全ての項目を入力してください');
      return;
    }

    setError(null);
    try {
      const res = await fetch('/api/lp-line-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          key: newKey.trim().toLowerCase(),
          label: newLabel.trim(),
          url: newUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '作成に失敗しました');
        return;
      }
      if (data.tag) {
        setTags([...tags, data.tag]);
      }
      setIsAdding(false);
      setNewKey('');
      setNewLabel('');
      setNewUrl('');
    } catch (error) {
      console.error('Failed to create line tag:', error);
      setError('作成に失敗しました');
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editLabel.trim() || !editUrl.trim()) {
      setError('表示名とURLは必須です');
      return;
    }

    setError(null);
    try {
      const res = await fetch('/api/lp-line-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id,
          key: editKey.trim().toLowerCase(),
          label: editLabel.trim(),
          url: editUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '更新に失敗しました');
        return;
      }
      // #7: API応答のtagデータを使用（サーバー側の正確な状態を反映）
      if (data.tag) {
        setTags(tags.map(t => t.id === id ? data.tag : t));
      }
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update line tag:', error);
      setError('更新に失敗しました');
    }
  };

  const handleSetDefault = async (id: number) => {
    setError(null);
    try {
      const res = await fetch('/api/lp-line-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id,
          is_default: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'デフォルト設定に失敗しました');
        return;
      }
      setTags(tags.map(t => ({ ...t, is_default: t.id === id })));
    } catch (error) {
      console.error('Failed to set default:', error);
      setError('デフォルト設定に失敗しました');
    }
  };

  const handleDelete = async (id: number, label: string) => {
    if (!confirm(`「${label}」を削除しますか？`)) {
      return;
    }

    setError(null);
    try {
      const res = await fetch('/api/lp-line-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '削除に失敗しました');
        return;
      }
      // 削除後のリストをAPIから再取得（デフォルトの繰り上げを正確に反映）
      await fetchTags();
    } catch (error) {
      console.error('Failed to delete line tag:', error);
      setError('削除に失敗しました');
    }
  };

  const startEdit = (tag: LineTag) => {
    setEditingId(tag.id);
    setEditKey(tag.key);
    setEditLabel(tag.label);
    setEditUrl(tag.url);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditKey('');
    setEditLabel('');
    setEditUrl('');
    setError(null);
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setNewKey('');
    setNewLabel('');
    setNewUrl('');
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            <h2 className="text-lg font-bold text-gray-900">LINEタグ管理</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* 新規追加フォーム */}
              {isAdding ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm font-medium text-green-800 mb-3">新規LINEタグ追加</div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          キー（utm_sourceの値）
                        </label>
                        <input
                          type="text"
                          value={newKey}
                          onChange={(e) => setNewKey(e.target.value)}
                          placeholder="例: tiktok"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          英小文字・数字・アンダースコアのみ
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          表示名
                        </label>
                        <input
                          type="text"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          placeholder="例: TikTok広告"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        LINE友だち追加URL
                      </label>
                      <input
                        type="text"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="https://liff.line.me/..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAdd();
                          if (e.key === 'Escape') cancelAdd();
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={handleAdd}
                        className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                      >
                        追加
                      </button>
                      <button
                        onClick={cancelAdd}
                        className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新規LINEタグ追加
                </button>
              )}

              {/* タグ一覧 */}
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className={`p-3 bg-white border rounded-lg ${tag.is_default ? 'border-green-300 bg-green-50/30' : 'border-gray-200'}`}
                >
                  {editingId === tag.id ? (
                    /* 編集モード */
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">キー</label>
                          <input
                            type="text"
                            value={editKey}
                            onChange={(e) => setEditKey(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">表示名</label>
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
                        <input
                          type="text"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate(tag.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdate(tag.id)}
                          className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 表示モード */
                    <div className="flex items-start gap-3">
                      {/* デフォルトマーク */}
                      <button
                        onClick={() => handleSetDefault(tag.id)}
                        className={`flex-shrink-0 mt-0.5 p-1 rounded transition-colors ${
                          tag.is_default
                            ? 'text-green-600'
                            : 'text-gray-300 hover:text-green-400'
                        }`}
                        title={tag.is_default ? 'デフォルト' : 'デフォルトに設定'}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>

                      {/* キー */}
                      <div className="flex-shrink-0 w-20">
                        <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono font-semibold text-gray-600">
                          {tag.key}
                        </code>
                      </div>

                      {/* 表示名 + URL */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {tag.label}
                          {tag.is_default && (
                            <span className="ml-2 text-xs font-normal text-green-600">デフォルト</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-0.5 font-mono">
                          {tag.url}
                        </div>
                      </div>

                      {/* アクションボタン */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => startEdit(tag)}
                          className="p-2 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="編集"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(tag.id, tag.label)}
                          className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="削除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {tags.length === 0 && !isAdding && (
                <div className="text-center py-8 text-gray-500">
                  LINEタグがありません
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-500 text-center">
            キー（key）は <code className="bg-gray-200 px-1 rounded">utm_source</code> パラメータとして使用されます。追加・編集は全LPに即座に反映されます。
          </p>
        </div>
      </div>
    </div>
  );
}
