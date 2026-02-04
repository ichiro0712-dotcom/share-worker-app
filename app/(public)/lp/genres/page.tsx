'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Genre = {
  id: number;
  prefix: string;
  name: string;
};

export default function GenresPage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrefix, setEditingPrefix] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGenres();
  }, []);

  const fetchGenres = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lp-code-genres');
      const data = await res.json();
      if (data.genres) {
        setGenres(data.genres);
      }
    } catch (error) {
      console.error('Failed to fetch genres:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError('ジャンル名を入力してください');
      return;
    }

    setError(null);
    try {
      const res = await fetch('/api/lp-code-genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: newName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '作成に失敗しました');
        return;
      }
      if (data.genre) {
        setGenres([...genres, data.genre]);
      }
      setIsAdding(false);
      setNewName('');
    } catch (error) {
      console.error('Failed to create genre:', error);
      setError('作成に失敗しました');
    }
  };

  const handleUpdate = async (prefix: string) => {
    if (!editValue.trim()) {
      setError('ジャンル名を入力してください');
      return;
    }

    const genre = genres.find(g => g.prefix === prefix);
    if (!genre) {
      setError('ジャンルが見つかりません');
      return;
    }

    setError(null);
    try {
      const res = await fetch('/api/lp-code-genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: genre.id,
          name: editValue.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '更新に失敗しました');
        return;
      }
      setGenres(genres.map(g => g.prefix === prefix ? { ...g, name: editValue.trim() } : g));
      setEditingPrefix(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to update genre:', error);
      setError('更新に失敗しました');
    }
  };

  const handleDelete = async (prefix: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\nこのジャンルのコードが使用されている場合は削除できません。`)) {
      return;
    }

    setError(null);
    try {
      const res = await fetch('/api/lp-code-genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          prefix: prefix,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '削除に失敗しました');
        return;
      }
      setGenres(genres.filter(g => g.prefix !== prefix));
    } catch (error) {
      console.error('Failed to delete genre:', error);
      setError('削除に失敗しました');
    }
  };

  const startEdit = (genre: Genre) => {
    setEditingPrefix(genre.prefix);
    setEditValue(genre.name);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingPrefix(null);
    setEditValue('');
    setError(null);
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setNewName('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/lp"
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">コードジャンル編集</h1>
              <p className="text-xs text-gray-500">キャンペーンコードのジャンル（広告媒体）を管理</p>
            </div>
          </div>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* コンテンツ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-rose-500 border-t-transparent" />
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* 新規追加フォーム */}
              {isAdding ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-blue-800 mb-3">新規ジャンル追加</div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        ジャンル名
                      </label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="例: YouTube広告"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAdd();
                          if (e.key === 'Escape') cancelAdd();
                        }}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        プレフィックス（AAH, AAI...）は自動で割り当てられます
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={handleAdd}
                        className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
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
                  className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新規ジャンル追加
                </button>
              )}

              {/* ジャンル一覧 */}
              {genres.map((genre) => (
                <div
                  key={genre.prefix}
                  className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  {/* プレフィックス */}
                  <div className="flex-shrink-0 w-14 h-8 bg-white border border-gray-200 rounded flex items-center justify-center">
                    <code className="text-xs font-mono font-semibold text-gray-600">
                      {genre.prefix}
                    </code>
                  </div>

                  {/* 名前（編集可能） */}
                  {editingPrefix === genre.prefix ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(genre.prefix);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        autoFocus
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
                      />
                      <button
                        onClick={() => handleUpdate(genre.prefix)}
                        className="px-3 py-1.5 text-xs font-medium bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors"
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
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {genre.name}
                        </div>
                      </div>

                      {/* アクションボタン */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(genre)}
                          className="p-2 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="名前を編集"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(genre.prefix, genre.name)}
                          className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="削除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {genres.length === 0 && !isAdding && (
                <div className="text-center py-8 text-gray-500">
                  ジャンルがありません
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッターヒント */}
        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
          <p className="text-xs text-gray-500 text-center">
            プレフィックスは自動で割り当てられ、変更できません。ジャンル名のみ編集可能です。
          </p>
        </div>
      </div>
    </div>
  );
}
