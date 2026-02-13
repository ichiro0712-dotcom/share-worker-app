'use client';

import { useState, useEffect, useRef } from 'react';
import GenreSelectModal from './components/GenreSelectModal';
import GenreEditModal from './components/GenreEditModal';
type Campaign = {
  code: string;
  name: string;
  createdAt: string;
  genreName?: string;
  genrePrefix?: string;
};

type LPPage = {
  id: string;
  path: string;
  title: string;
  isActive: boolean;
  campaigns: Campaign[];
};

export default function LPList({ initialPages }: { initialPages: LPPage[] }) {
  const [pages, setPages] = useState(initialPages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // クライアント側のoriginを保持（hydrationエラー回避）
  const [origin, setOrigin] = useState('');

  // クライアント側でoriginを設定
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // モーダル状態
  const [genreSelectModalOpen, setGenreSelectModalOpen] = useState(false);
  const [genreEditModalOpen, setGenreEditModalOpen] = useState(false);
  const [selectedLpIdForCode, setSelectedLpIdForCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);


  // ページ遷移で戻った時に最新データを取得
  useEffect(() => {
    const fetchLatestData = async () => {
      try {
        const response = await fetch('/api/lp-config?action=list');
        if (response.ok) {
          const data = await response.json();
          if (data.pages) {
            setPages(data.pages);
          }
        }
      } catch (e) {
        console.error('Failed to fetch latest LP data:', e);
      }
    };
    fetchLatestData();
  }, []);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    if (menuOpenId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId]);

  const startEdit = (page: LPPage) => {
    setEditingId(page.id);
    setEditValue(page.title);
    setMenuOpenId(null);
  };

  const saveEdit = async (id: string) => {
    try {
      await fetch('/api/lp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: editValue }),
      });
      setPages(pages.map(p => p.id === id ? { ...p, title: editValue } : p));
      setEditingId(null);
    } catch {
      alert('保存に失敗しました');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setMenuOpenId(null);
  };

  // ジャンル選択モーダルを開く
  const openGenreSelectModal = (lpId: string) => {
    setSelectedLpIdForCode(lpId);
    setGenreSelectModalOpen(true);
  };

  // ジャンル選択後にコード発行（DB APIを使用）
  const handleGenreSelect = async (genrePrefix: string, genreName: string) => {
    if (!selectedLpIdForCode) return;

    setGenreSelectModalOpen(false);
    setIsGeneratingCode(true);

    try {
      // ジャンルIDを取得
      const genresRes = await fetch('/api/lp-code-genres');
      const genresData = await genresRes.json();
      const genre = genresData.genres?.find((g: { prefix: string }) => g.prefix === genrePrefix);

      if (!genre) {
        alert('ジャンルが見つかりません');
        return;
      }

      // DB APIでコード生成
      const res = await fetch('/api/lp-campaign-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          lpId: selectedLpIdForCode,
          genreId: genre.id,
          name: `${genreName} - `,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'コードの発行に失敗しました');
        return;
      }

      // 生成されたコードをUIに反映
      const newCampaign = {
        code: data.code.code,
        name: data.code.name || `${genreName} - ${data.code.code}`,
        createdAt: data.code.created_at,
        genreName,
        genrePrefix,
      };

      // JSONファイルにも保存（既存の仕組みとの互換性維持）
      await fetch('/api/lp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedLpIdForCode,
          action: 'addCampaign',
          campaign: newCampaign,
        }),
      });

      setPages(pages.map(p => {
        if (p.id === selectedLpIdForCode) {
          return { ...p, campaigns: [...(p.campaigns || []), newCampaign] };
        }
        return p;
      }));

      // 展開状態にする
      setExpandedId(selectedLpIdForCode);
    } catch (error) {
      console.error('Failed to generate code:', error);
      alert('コードの発行に失敗しました');
    } finally {
      setIsGeneratingCode(false);
      setSelectedLpIdForCode(null);
    }
  };

  const deleteCampaign = async (lpId: string, code: string) => {
    if (!confirm('このキャンペーンコードを削除しますか？')) return;
    try {
      // DB APIでコードを検索して削除
      const searchRes = await fetch(`/api/lp-campaign-codes?code=${encodeURIComponent(code)}`);
      const searchData = await searchRes.json();

      if (searchData.valid && searchData.code) {
        // DB APIで削除
        await fetch('/api/lp-campaign-codes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id: searchData.code.id }),
        });
      }

      // JSONファイルからも削除（互換性維持）
      await fetch('/api/lp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lpId, action: 'deleteCampaign', code }),
      });

      setPages(pages.map(p => {
        if (p.id === lpId) {
          return { ...p, campaigns: (p.campaigns || []).filter(c => c.code !== code) };
        }
        return p;
      }));
    } catch {
      alert('削除に失敗しました');
    }
  };

  const toggleStatus = async (lpId: string) => {
    try {
      const response = await fetch('/api/lp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lpId, action: 'toggleStatus' }),
      });
      if (response.ok) {
        setPages(pages.map(p => p.id === lpId ? { ...p, isActive: !p.isActive } : p));
      }
    } catch {
      alert('ステータス変更に失敗しました');
    }
    setMenuOpenId(null);
  };

  const activePages = pages.filter(p => p.isActive !== false);
  const inactivePages = pages.filter(p => p.isActive === false);

  const copyToClipboard = (text: string, code: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getFullUrl = (path: string, code?: string) => {
    return code ? `${origin}${path}?c=${code}` : `${origin}${path}`;
  };

  // プレフィックスからジャンル名を判定（genreNameがない古いコード用）
  const getGenreFromCode = (code: string): string | null => {
    const match = code.match(/^([A-Z]{3})-/);
    if (!match) return null;
    // プレフィックスを返す（ジャンル名はcampaign.genreNameで取得）
    return match[1];
  };

  const renderLpCard = (page: LPPage) => (
    <div
      key={page.id}
      className={`
        rounded-lg border transition-all duration-200
        ${page.isActive === false
          ? 'border-gray-200 bg-gray-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
        }
      `}
    >
      {/* カードヘッダー */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* LP番号バッジ */}
          <div className={`
            flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold
            ${page.isActive === false
              ? 'bg-gray-200 text-gray-500'
              : 'bg-gradient-to-br from-rose-500 to-rose-600 text-white'
            }
          `}>
            {page.id}
          </div>

          {/* タイトル & ステータス */}
          <div className="flex-1 min-w-0">
            {editingId === page.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(page.id);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  autoFocus
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
                  placeholder="LPタイトル"
                />
                <button
                  onClick={() => saveEdit(page.id)}
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
              <div className="flex items-center gap-2">
                <h3
                  onClick={() => startEdit(page)}
                  className={`
                    text-sm font-medium cursor-pointer group flex items-center gap-1.5
                    ${page.isActive === false ? 'text-gray-400' : 'text-gray-900 hover:text-rose-600'}
                  `}
                  title="クリックして名前を編集"
                >
                  {page.title}
                  <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </h3>
                {page.isActive === false && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-500 rounded">
                    停止中
                  </span>
                )}
              </div>
            )}

            {/* メタ情報 */}
            {editingId !== page.id && (
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {(page.campaigns || []).length} コード
                </span>
              </div>
            )}
          </div>

          {/* アクションボタン群 */}
          {editingId !== page.id && (
            <div className="flex items-center gap-2">
              {/* プレビューボタン */}
              <a
                href={page.path}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="プレビュー"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              {/* URLコピーボタン */}
              <button
                onClick={() => copyToClipboard(getFullUrl(page.path), `lp-${page.id}`)}
                className={`
                  p-2 rounded-md transition-colors
                  ${copiedCode === `lp-${page.id}`
                    ? 'text-green-600 bg-green-50'
                    : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                  }
                `}
                title={copiedCode === `lp-${page.id}` ? 'コピーしました' : 'URLをコピー'}
              >
                {copiedCode === `lp-${page.id}` ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>

              {/* コード管理ボタン */}
              <button
                onClick={() => toggleExpand(page.id)}
                className={`
                  px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1
                  ${expandedId === page.id
                    ? 'bg-gray-700 text-white'
                    : 'bg-rose-600 text-white hover:bg-rose-700'
                  }
                `}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {expandedId === page.id ? '閉じる' : 'コード'}
              </button>

              {/* メニューボタン */}
              <div className="relative" ref={menuOpenId === page.id ? menuRef : null}>
                <button
                  onClick={() => setMenuOpenId(menuOpenId === page.id ? null : page.id)}
                  className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </button>

                {/* ドロップダウンメニュー */}
                {menuOpenId === page.id && (
                  <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                    <button
                      onClick={() => toggleStatus(page.id)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      {page.isActive === false ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          有効にする
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-gray-400" />
                          停止する
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* キャンペーンコード展開エリア */}
      {expandedId === page.id && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4">
          {/* 新規コード発行ボタン */}
          <button
            onClick={() => openGenreSelectModal(page.id)}
            disabled={isGeneratingCode}
            className="mb-4 px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isGeneratingCode && selectedLpIdForCode === page.id ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                発行中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新規コード発行
              </>
            )}
          </button>

          {/* キャンペーン一覧 */}
          {(page.campaigns || []).length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              キャンペーンコードがありません
            </div>
          ) : (
            <div className="space-y-2">
              {(page.campaigns || []).map((campaign) => {
                const genre = campaign.genreName || getGenreFromCode(campaign.code);
                return (
                  <div
                    key={campaign.code}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
                  >
                    <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono font-semibold text-gray-700">
                      {campaign.code}
                    </code>
                    {genre && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        {genre}
                      </span>
                    )}
                    <span className="flex-1 text-sm text-gray-600 truncate">
                      {campaign.name}
                    </span>
                    <button
                      onClick={() => copyToClipboard(getFullUrl(page.path, campaign.code), campaign.code)}
                      className={`
                        p-1.5 rounded transition-colors
                        ${copiedCode === campaign.code
                          ? 'text-green-600 bg-green-50'
                          : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                        }
                      `}
                      title={copiedCode === campaign.code ? 'コピーしました' : 'URLをコピー'}
                    >
                      {copiedCode === campaign.code ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => deleteCampaign(page.id, campaign.code)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="削除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        {/* 有効なLP */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <h2 className="text-sm font-semibold text-gray-700">
              有効 ({activePages.length})
            </h2>
          </div>
          <div className="space-y-3">
            {activePages.map(renderLpCard)}
            {activePages.length === 0 && (
              <div className="py-8 text-center text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                有効なLPがありません
              </div>
            )}
          </div>
        </div>

        {/* 停止中のLP */}
        {inactivePages.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              <h2 className="text-sm font-semibold text-gray-500">
                停止中 ({inactivePages.length})
              </h2>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              トラッキング一覧に表示されません。データは保持されています。
            </p>
            <div className="space-y-3">
              {inactivePages.map(renderLpCard)}
            </div>
          </div>
        )}

        {pages.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            LPページが見つかりません
          </div>
        )}
      </div>

      {/* ジャンル選択モーダル */}
      <GenreSelectModal
        isOpen={genreSelectModalOpen}
        onClose={() => {
          setGenreSelectModalOpen(false);
          setSelectedLpIdForCode(null);
        }}
        onSelect={handleGenreSelect}
        onOpenGenreEdit={() => setGenreEditModalOpen(true)}
      />

      {/* ジャンル編集モーダル */}
      <GenreEditModal
        isOpen={genreEditModalOpen}
        onClose={() => setGenreEditModalOpen(false)}
      />

    </>
  );
}
