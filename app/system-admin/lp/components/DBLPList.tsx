'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, Eye, CheckCircle, XCircle, Trash2, Download, Code, BarChart3, GripVertical, Copy, EyeOff } from 'lucide-react';
import Link from 'next/link';
import LPUploadModal from './LPUploadModal';
import GenreSelectModal from './GenreSelectModal';
import GenreEditModal from './GenreEditModal';
import HtmlEditModal from './HtmlEditModal';
import { getLandingPages, deleteLandingPage, updateLandingPageName, updateLandingPageCtaUrl, toggleLpHidden, updateLpSortOrders, copyLandingPage } from '@/lib/lp-actions';
import type { LandingPage } from '@prisma/client';

type Campaign = {
  code: string;
  name: string;
  createdAt: string;
  genreName?: string;
  genrePrefix?: string;
};

type DBLPListProps = {
  initialPages: LandingPage[];
};

export default function DBLPList({ initialPages }: DBLPListProps) {
  const [pages, setPages] = useState<LandingPage[]>(initialPages);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editLpNumber, setEditLpNumber] = useState<number | undefined>(undefined);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // D&D並び替え
  const [draggedLpNumber, setDraggedLpNumber] = useState<number | null>(null);
  const [dragOverLpNumber, setDragOverLpNumber] = useState<number | null>(null);

  // 非表示LP表示
  const [showHidden, setShowHidden] = useState(false);

  // コピー中
  const [isCopying, setIsCopying] = useState<number | null>(null);

  // キャンペーンコード（LP番号→コード配列のマップ）
  const [campaignsByLp, setCampaignsByLp] = useState<Record<number, Campaign[]>>({});

  // クライアント側のoriginを保持
  const [origin, setOrigin] = useState('');

  // HTML編集モーダル状態
  const [htmlEditModalOpen, setHtmlEditModalOpen] = useState(false);
  const [htmlEditLpNumber, setHtmlEditLpNumber] = useState<number>(0);
  const [htmlEditLpName, setHtmlEditLpName] = useState<string>('');

  // CTA URL編集状態
  const [ctaEditingId, setCtaEditingId] = useState<number | null>(null);
  const [ctaEditValue, setCtaEditValue] = useState('');

  // モーダル状態
  const [genreSelectModalOpen, setGenreSelectModalOpen] = useState(false);
  const [genreEditModalOpen, setGenreEditModalOpen] = useState(false);
  const [selectedLpNumberForCode, setSelectedLpNumberForCode] = useState<number | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  // クライアント側でoriginを設定
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // タグ再チェック（手動トリガー）
  const [isCheckingTags, setIsCheckingTags] = useState(false);
  const recheckTags = async () => {
    const lpNumbers = pages.map(p => p.lp_number);
    if (lpNumbers.length === 0) return;
    setIsCheckingTags(true);
    try {
      const res = await fetch('/api/lp/check-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lpNumbers }),
      });
      if (res.ok) {
        const data = await res.json();
        setPages(prev =>
          prev.map(p => {
            const result = data.results?.find(
              (r: { lpNumber: number }) => r.lpNumber === p.lp_number
            );
            if (result?.checks) {
              return {
                ...p,
                has_gtm: result.checks.has_gtm,
                has_tracking: result.checks.has_tracking,
              };
            }
            return p;
          })
        );
      }
    } catch (e) {
      console.error('Failed to check tags:', e);
    } finally {
      setIsCheckingTags(false);
    }
  };

  // キャンペーンコードを一括取得（N+1問題の解消）
  useEffect(() => {
    const fetchAllCampaigns = async () => {
      try {
        // lpIdを指定しないと全コードを取得
        const res = await fetch('/api/lp-campaign-codes');
        const data = await res.json();

        // LP番号でグルーピング
        const campaigns: Record<number, Campaign[]> = {};
        if (data.codes) {
          for (const c of data.codes) {
            const lpNumber = parseInt(c.lp_id, 10);
            if (!campaigns[lpNumber]) {
              campaigns[lpNumber] = [];
            }
            campaigns[lpNumber].push({
              code: c.code,
              name: c.name || c.code,
              createdAt: c.created_at,
              genreName: c.genre?.name,
              genrePrefix: c.genre?.prefix,
            });
          }
        }
        setCampaignsByLp(campaigns);
      } catch (e) {
        console.error('Failed to fetch campaign codes:', e);
        setCampaignsByLp({});
      }
    };
    if (pages.length > 0) {
      fetchAllCampaigns();
    }
  }, [pages]);

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

  const refreshPages = async () => {
    const freshPages = await getLandingPages();
    setPages(freshPages);
  };

  const openUploadModal = (lpNumber?: number) => {
    setEditLpNumber(lpNumber);
    setIsUploadModalOpen(true);
  };

  const handleDelete = async (lpNumber: number, name: string) => {
    if (!confirm(`「${name}」(LP ${lpNumber}) を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }
    setDeletingId(lpNumber);
    try {
      const result = await deleteLandingPage(lpNumber);
      if (result.success) {
        await refreshPages();
      } else {
        alert(result.error || '削除に失敗しました');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (lp: LandingPage) => {
    setEditingId(lp.id);
    setEditValue(lp.name);
    setMenuOpenId(null);
  };

  const saveEdit = async (lp: LandingPage) => {
    if (!editValue.trim()) {
      setEditingId(null);
      return;
    }
    const result = await updateLandingPageName(lp.lp_number, editValue.trim());
    if (result.success) {
      await refreshPages();
    } else {
      alert(result.error || '更新に失敗しました');
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const startCtaEdit = (lp: LandingPage) => {
    setCtaEditingId(lp.id);
    setCtaEditValue(lp.cta_url || '');
  };

  const saveCtaEdit = async (lp: LandingPage) => {
    const url = ctaEditValue.trim();
    const result = await updateLandingPageCtaUrl(lp.lp_number, url || null);
    if (result.success) {
      await refreshPages();
    } else {
      alert(result.error || '更新に失敗しました');
    }
    setCtaEditingId(null);
  };

  const cancelCtaEdit = () => {
    setCtaEditingId(null);
    setCtaEditValue('');
  };

  const toggleExpand = (lpNumber: number) => {
    setExpandedId(expandedId === lpNumber ? null : lpNumber);
    setMenuOpenId(null);
  };

  // ジャンル選択モーダルを開く
  const openGenreSelectModal = (lpNumber: number) => {
    setSelectedLpNumberForCode(lpNumber);
    setGenreSelectModalOpen(true);
  };

  // ジャンル選択後にコード発行
  const handleGenreSelect = async (genrePrefix: string, genreName: string) => {
    if (selectedLpNumberForCode === null) return;

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
          lpId: selectedLpNumberForCode.toString(),
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
      const newCampaign: Campaign = {
        code: data.code.code,
        name: data.code.name || `${genreName} - ${data.code.code}`,
        createdAt: data.code.created_at,
        genreName,
        genrePrefix,
      };

      setCampaignsByLp(prev => ({
        ...prev,
        [selectedLpNumberForCode]: [...(prev[selectedLpNumberForCode] || []), newCampaign],
      }));

      // 展開状態にする
      setExpandedId(selectedLpNumberForCode);
    } catch (error) {
      console.error('Failed to generate code:', error);
      alert('コードの発行に失敗しました');
    } finally {
      setIsGeneratingCode(false);
      setSelectedLpNumberForCode(null);
    }
  };

  const deleteCampaign = async (lpNumber: number, code: string) => {
    if (!confirm('このキャンペーンコードを削除しますか？')) return;
    try {
      // DB APIでコードを検索して削除
      const searchRes = await fetch(`/api/lp-campaign-codes?code=${encodeURIComponent(code)}`);
      const searchData = await searchRes.json();

      if (searchData.valid && searchData.code) {
        await fetch('/api/lp-campaign-codes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id: searchData.code.id }),
        });
      }

      setCampaignsByLp(prev => ({
        ...prev,
        [lpNumber]: (prev[lpNumber] || []).filter(c => c.code !== code),
      }));
    } catch {
      alert('削除に失敗しました');
    }
  };

  const copyToClipboard = (text: string, code: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // LP非表示
  const handleHide = async (lpNumber: number) => {
    setMenuOpenId(null);
    const result = await toggleLpHidden(lpNumber, true);
    if (result.success) {
      await refreshPages();
    } else {
      alert(result.error || '非表示に失敗しました');
    }
  };

  // LP再表示
  const handleUnhide = async (lpNumber: number) => {
    const result = await toggleLpHidden(lpNumber, false);
    if (result.success) {
      await refreshPages();
    } else {
      alert(result.error || '再表示に失敗しました');
    }
  };

  // LPコピー
  const handleCopy = async (lpNumber: number) => {
    setMenuOpenId(null);
    setIsCopying(lpNumber);
    try {
      const result = await copyLandingPage(lpNumber);
      if (result.success) {
        await refreshPages();
      } else {
        alert(result.error || 'コピーに失敗しました');
      }
    } finally {
      setIsCopying(null);
    }
  };

  // D&Dハンドラー
  const handleDragStart = (lpNumber: number) => {
    setDraggedLpNumber(lpNumber);
  };

  const handleDragOver = (e: React.DragEvent, lpNumber: number) => {
    e.preventDefault();
    setDragOverLpNumber(lpNumber);
  };

  const handleDragLeave = () => {
    setDragOverLpNumber(null);
  };

  const handleDrop = async (targetLpNumber: number) => {
    if (draggedLpNumber === null || draggedLpNumber === targetLpNumber) {
      setDraggedLpNumber(null);
      setDragOverLpNumber(null);
      return;
    }

    // activePages内で並び替え
    const currentOrder = [...activePages];
    const draggedIdx = currentOrder.findIndex(p => p.lp_number === draggedLpNumber);
    const targetIdx = currentOrder.findIndex(p => p.lp_number === targetLpNumber);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedLpNumber(null);
      setDragOverLpNumber(null);
      return;
    }

    const [dragged] = currentOrder.splice(draggedIdx, 1);
    currentOrder.splice(targetIdx, 0, dragged);

    // sort_orderを再計算して保存
    const orders = currentOrder.map((p, i) => ({
      lpNumber: p.lp_number,
      sortOrder: i,
    }));

    const result = await updateLpSortOrders(orders);
    if (result.success) {
      await refreshPages();
    } else {
      alert(result.error || '並び替えの保存に失敗しました');
    }

    setDraggedLpNumber(null);
    setDragOverLpNumber(null);
  };

  const handleDragEnd = () => {
    setDraggedLpNumber(null);
    setDragOverLpNumber(null);
  };

  // 配信URLを生成（delivery_lp_number + delivery_utm_source がある場合はそちらを使用）
  const getDeliveryUrl = (lp: LandingPage, code?: string) => {
    const deliveryLp = lp.delivery_lp_number ?? lp.lp_number;
    const basePath = `/api/lp/${deliveryLp}`;
    const params = new URLSearchParams();
    if (lp.delivery_utm_source) {
      params.set('utm_source', lp.delivery_utm_source);
    }
    if (code) {
      params.set('c', code);
    }
    const qs = params.toString();
    return qs ? `${origin}${basePath}?${qs}` : `${origin}${basePath}`;
  };

  // タグの警告を表示するかどうか
  const hasWarning = (lp: LandingPage) => {
    return !lp.has_gtm || !lp.has_tracking;
  };

  const hiddenPages = pages.filter(p => p.is_hidden === true);
  const visiblePages = pages.filter(p => !p.is_hidden);
  const activePages = visiblePages.filter(p => p.is_published !== false);
  const inactivePages = visiblePages.filter(p => p.is_published === false);

  const renderLpCard = (lp: LandingPage, isDraggable = false) => {
    const campaigns = campaignsByLp[lp.lp_number] || [];
    const isBeingDragged = draggedLpNumber === lp.lp_number;
    const isDragTarget = dragOverLpNumber === lp.lp_number;

    return (
      <div
        key={lp.id}
        draggable={isDraggable}
        onDragStart={() => isDraggable && handleDragStart(lp.lp_number)}
        onDragOver={(e) => isDraggable && handleDragOver(e, lp.lp_number)}
        onDragLeave={isDraggable ? handleDragLeave : undefined}
        onDrop={() => isDraggable && handleDrop(lp.lp_number)}
        onDragEnd={isDraggable ? handleDragEnd : undefined}
        className={`
          rounded-lg border transition-all duration-200
          ${lp.is_published === false
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          }
          ${isBeingDragged ? 'opacity-50' : ''}
          ${isDragTarget ? 'border-rose-400 shadow-md' : ''}
        `}
      >
        {/* カードヘッダー */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* D&Dハンドル */}
            {isDraggable && (
              <div className="flex-shrink-0 cursor-grab active:cursor-grabbing pt-2 text-gray-400 hover:text-gray-600">
                <GripVertical className="w-5 h-5" />
              </div>
            )}
            {/* LP番号バッジ */}
            <div className={`
              flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold
              ${lp.is_published === false
                ? 'bg-gray-200 text-gray-500'
                : 'bg-gradient-to-br from-rose-500 to-rose-600 text-white'
              }
            `}>
              {lp.lp_number}
            </div>

            {/* タイトル & ステータス */}
            <div className="flex-1 min-w-0">
              {editingId === lp.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(lp);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    autoFocus
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
                    placeholder="LPタイトル"
                  />
                  <button
                    onClick={() => saveEdit(lp)}
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
                    onClick={() => startEdit(lp)}
                    className={`
                      text-sm font-medium cursor-pointer group flex items-center gap-1.5
                      ${lp.is_published === false ? 'text-gray-400' : 'text-gray-900 hover:text-rose-600'}
                    `}
                    title="クリックして名前を編集"
                  >
                    {lp.name}
                    <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </h3>
                  {lp.is_published === false && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-500 rounded">
                      停止中
                    </span>
                  )}
                </div>
              )}

              {/* メタ情報 */}
              {editingId !== lp.id && (
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {/* 配信URL */}
                    {lp.delivery_lp_number != null && lp.delivery_utm_source && (
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-mono text-[10px]">
                        /api/lp/{lp.delivery_lp_number}?utm_source={lp.delivery_utm_source}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {campaigns.length} コード
                    </span>
                    {/* タグステータス */}
                    <div className="flex items-center gap-1">
                      <TagBadge label="GTM" hasTag={lp.has_gtm} />
                      <TagBadge label="Track" hasTag={lp.has_tracking} />
                    </div>
                  </div>
                  {/* CTA URL */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 flex-shrink-0">CTA:</span>
                    {ctaEditingId === lp.id ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="url"
                          value={ctaEditValue}
                          onChange={(e) => setCtaEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveCtaEdit(lp);
                            if (e.key === 'Escape') cancelCtaEdit();
                          }}
                          autoFocus
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none font-mono"
                          placeholder="https://..."
                        />
                        <button
                          onClick={() => saveCtaEdit(lp)}
                          className="px-2 py-1 text-[10px] font-medium bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelCtaEdit}
                          className="px-2 py-1 text-[10px] font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <span
                        onClick={() => startCtaEdit(lp)}
                        className="text-gray-500 hover:text-rose-600 cursor-pointer truncate max-w-[300px] group flex items-center gap-1"
                        title={lp.cta_url || '未設定（クリックして設定）'}
                      >
                        {lp.cta_url ? (
                          <span className="font-mono text-[10px] text-blue-600">{lp.cta_url}</span>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">未設定</span>
                        )}
                        <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 警告アイコン */}
            {hasWarning(lp) && editingId !== lp.id && (
              <div className="p-1" title="一部のタグが挿入されていません">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
            )}

            {/* アクションボタン群 */}
            {editingId !== lp.id && (
              <div className="flex items-center gap-2">
                {/* プレビューボタン（LINEタグ付きURL） */}
                <a
                  href={getDeliveryUrl(lp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="プレビュー"
                >
                  <Eye className="w-4 h-4" />
                </a>

                {/* URLコピーボタン（LINEタグ付きURL） */}
                <button
                  onClick={() => copyToClipboard(getDeliveryUrl(lp), `lp-${lp.lp_number}`)}
                  className={`
                    p-2 rounded-md transition-colors
                    ${copiedCode === `lp-${lp.lp_number}`
                      ? 'text-green-600 bg-green-50'
                      : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                    }
                  `}
                  title={copiedCode === `lp-${lp.lp_number}` ? 'コピーしました' : 'URLをコピー'}
                >
                  {copiedCode === `lp-${lp.lp_number}` ? (
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
                  onClick={() => toggleExpand(lp.lp_number)}
                  className={`
                    px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1
                    ${expandedId === lp.lp_number
                      ? 'bg-gray-700 text-white'
                      : 'bg-rose-600 text-white hover:bg-rose-700'
                    }
                  `}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {expandedId === lp.lp_number ? '閉じる' : 'コード'}
                </button>

                {/* メニューボタン */}
                <div className="relative" ref={menuOpenId === lp.lp_number ? menuRef : null}>
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === lp.lp_number ? null : lp.lp_number)}
                    className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>

                  {/* ドロップダウンメニュー */}
                  {menuOpenId === lp.lp_number && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                      <button
                        onClick={() => {
                          setHtmlEditLpNumber(lp.lp_number);
                          setHtmlEditLpName(lp.name);
                          setHtmlEditModalOpen(true);
                          setMenuOpenId(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Code className="w-4 h-4" />
                        HTML編集
                      </button>
                      <button
                        onClick={() => {
                          openUploadModal(lp.lp_number);
                          setMenuOpenId(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        再アップロード
                      </button>
                      <a
                        href={`/api/lp/${lp.lp_number}/download`}
                        onClick={() => setMenuOpenId(null)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        ファイルDL
                      </a>
                      <button
                        onClick={() => handleCopy(lp.lp_number)}
                        disabled={isCopying === lp.lp_number}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        {isCopying === lp.lp_number ? 'コピー中...' : 'コピー'}
                      </button>
                      <button
                        onClick={() => handleHide(lp.lp_number)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <EyeOff className="w-4 h-4" />
                        非表示
                      </button>
                      <button
                        onClick={() => {
                          handleDelete(lp.lp_number, lp.name);
                          setMenuOpenId(null);
                        }}
                        disabled={deletingId === lp.lp_number}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        削除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* キャンペーンコード展開エリア */}
        {expandedId === lp.lp_number && (
          <div className="border-t border-gray-100 bg-gray-50/50 p-4">
            {/* 新規コード発行ボタン */}
            <button
              onClick={() => openGenreSelectModal(lp.lp_number)}
              disabled={isGeneratingCode}
              className="mb-4 px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isGeneratingCode && selectedLpNumberForCode === lp.lp_number ? (
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
            {campaigns.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                キャンペーンコードがありません
              </div>
            ) : (
              <div className="space-y-2">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.code}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
                  >
                    <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono font-semibold text-gray-700">
                      {campaign.code}
                    </code>
                    {campaign.genreName && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        {campaign.genreName}
                      </span>
                    )}
                    <span className="flex-1 text-sm text-gray-600 truncate">
                      {campaign.name}
                    </span>
                    <button
                      onClick={() => copyToClipboard(getDeliveryUrl(lp, campaign.code), campaign.code)}
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
                      onClick={() => deleteCampaign(lp.lp_number, campaign.code)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="削除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // LP0用の状態管理
  const [lp0Expanded, setLp0Expanded] = useState(false);
  const lp0Campaigns = campaignsByLp[0] || [];

  const getLp0Url = (code?: string) => {
    const basePath = '/public/jobs';
    if (code) {
      return `${origin}${basePath}?c=${code}`;
    }
    return `${origin}${basePath}`;
  };

  const renderLp0Card = () => (
    <div className="rounded-lg border-2 border-blue-300 bg-blue-50/50 mb-6">
      {/* カードヘッダー */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* LP0バッジ */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            0
          </div>

          {/* タイトル & ステータス */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-gray-900">
                公開求人検索
              </h3>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-200 text-blue-700 rounded">
                システム
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
              <span className="font-mono text-[10px]">/public/jobs</span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {lp0Campaigns.length} コード
              </span>
            </div>
          </div>

          {/* アクションボタン群 */}
          <div className="flex items-center gap-2">
            {/* プレビュー */}
            <a
              href={getLp0Url()}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="プレビュー"
            >
              <Eye className="w-4 h-4" />
            </a>

            {/* URLコピー */}
            <button
              onClick={() => copyToClipboard(getLp0Url(), 'lp-0')}
              className={`p-2 rounded-md transition-colors ${
                copiedCode === 'lp-0'
                  ? 'text-green-600 bg-green-50'
                  : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
              }`}
              title={copiedCode === 'lp-0' ? 'コピーしました' : 'URLをコピー'}
            >
              {copiedCode === 'lp-0' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            {/* コード管理 */}
            <button
              onClick={() => setLp0Expanded(!lp0Expanded)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                lp0Expanded
                  ? 'bg-gray-700 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              {lp0Expanded ? '閉じる' : 'コード'}
            </button>

            {/* トラッキング */}
            <Link
              href="/system-admin/lp/tracking/public-jobs"
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              トラッキング
            </Link>
          </div>
        </div>
      </div>

      {/* キャンペーンコード展開エリア */}
      {lp0Expanded && (
        <div className="border-t border-blue-200 bg-blue-50/30 p-4">
          {/* 新規コード発行 */}
          <button
            onClick={() => {
              setSelectedLpNumberForCode(0);
              setGenreSelectModalOpen(true);
            }}
            disabled={isGeneratingCode}
            className="mb-4 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isGeneratingCode && selectedLpNumberForCode === 0 ? (
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
          {lp0Campaigns.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              キャンペーンコードがありません
            </div>
          ) : (
            <div className="space-y-2">
              {lp0Campaigns.map((campaign) => (
                <div
                  key={campaign.code}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
                >
                  <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono font-semibold text-gray-700">
                    {campaign.code}
                  </code>
                  {campaign.genreName && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                      {campaign.genreName}
                    </span>
                  )}
                  <span className="flex-1 text-sm text-gray-600 truncate">
                    {campaign.name}
                  </span>
                  <button
                    onClick={() => copyToClipboard(getLp0Url(campaign.code), campaign.code)}
                    className={`p-1.5 rounded transition-colors ${
                      copiedCode === campaign.code
                        ? 'text-green-600 bg-green-50'
                        : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                    }`}
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
                    onClick={() => deleteCampaign(0, campaign.code)}
                    className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="削除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          DB管理LP ({pages.length})
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={recheckTags}
            disabled={isCheckingTags}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5
              ${isCheckingTags
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }
            `}
            title="全LPのHTMLをスキャンしてタグフラグを更新"
          >
            {isCheckingTags ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-400 border-t-transparent" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            タグ再チェック
          </button>
          <button
            onClick={refreshPages}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            title="更新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => openUploadModal()}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            新規LP追加
          </button>
        </div>
      </div>

      {/* LP0 - 公開求人検索（システムLP） */}
      {renderLp0Card()}

      {/* LP一覧 */}
      {pages.length === 0 ? (
        <div className="py-12 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <p>まだLPがありません</p>
          <p className="text-sm mt-1">「新規LP追加」からZIPファイルをアップロードしてください</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 有効なLP */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <h2 className="text-sm font-semibold text-gray-700">
                有効 ({activePages.length})
              </h2>
              {hiddenPages.length > 0 && (
                <button
                  onClick={() => setShowHidden(!showHidden)}
                  className="ml-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showHidden ? '非表示を閉じる' : `非表示を表示（${hiddenPages.length}）`}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {activePages.map(lp => renderLpCard(lp, true))}
              {activePages.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  有効なLPがありません
                </div>
              )}
            </div>
          </div>

          {/* 非表示LP */}
          {showHidden && hiddenPages.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <h2 className="text-sm font-semibold text-gray-400">
                  非表示 ({hiddenPages.length})
                </h2>
              </div>
              <div className="space-y-3">
                {hiddenPages.map(lp => (
                  <div key={lp.id} className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500">
                        {lp.lp_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-400">{lp.name}</h3>
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-500 rounded">
                          非表示
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnhide(lp.lp_number)}
                        className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        再表示
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                {inactivePages.map(lp => renderLpCard(lp))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* アップロードモーダル */}
      <LPUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setEditLpNumber(undefined);
        }}
        onSuccess={refreshPages}
        editLpNumber={editLpNumber}
      />

      {/* ジャンル選択モーダル */}
      <GenreSelectModal
        isOpen={genreSelectModalOpen}
        onClose={() => {
          setGenreSelectModalOpen(false);
          setSelectedLpNumberForCode(null);
        }}
        onSelect={handleGenreSelect}
        onOpenGenreEdit={() => setGenreEditModalOpen(true)}
      />

      {/* ジャンル編集モーダル */}
      <GenreEditModal
        isOpen={genreEditModalOpen}
        onClose={() => setGenreEditModalOpen(false)}
      />

      {/* HTML編集モーダル */}
      <HtmlEditModal
        isOpen={htmlEditModalOpen}
        onClose={() => setHtmlEditModalOpen(false)}
        lpNumber={htmlEditLpNumber}
        lpName={htmlEditLpName}
        onSaved={refreshPages}
      />

    </>
  );
}

// タグバッジコンポーネント
function TagBadge({ label, hasTag }: { label: string; hasTag: boolean }) {
  return (
    <span
      className={`
        inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-medium rounded
        ${hasTag
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-700'
        }
      `}
    >
      {hasTag ? (
        <CheckCircle className="w-2.5 h-2.5" />
      ) : (
        <XCircle className="w-2.5 h-2.5" />
      )}
      {label}
    </span>
  );
}
