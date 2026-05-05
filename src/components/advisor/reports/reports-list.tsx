'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Loader2, FileText, Bookmark, BookmarkCheck, ArrowUpDown } from 'lucide-react'
import {
  listReportHistory,
  type ClientHistoryRow,
} from '@/src/lib/advisor/actions/report-versions'
import { toggleBookmark } from '@/src/lib/advisor/actions/conversations'

const PAGE_SIZE = 50
/** しおり OFF セッションの保持期間 (advisor-cleanup cron と一致) */
const RETENTION_DRAFT_DAYS = 30

type SortKey = 'created_desc' | 'bookmark_first'

export function ReportsListClient() {
  const router = useRouter()
  const [rows, setRows] = useState<ClientHistoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [sortBy, setSortBy] = useState<SortKey>('created_desc')
  const [bookmarkPending, setBookmarkPending] = useState<Set<string>>(new Set())

  // chat-layout 側は useSearchParams で ?c= の変化に追従するので SPA 遷移で OK。
  function openSession(sessionId: string) {
    if (!sessionId) return
    router.push(`/system-admin/advisor?c=${encodeURIComponent(sessionId)}`)
  }

  const reload = useCallback(async () => {
    setLoading(true)
    const result = await listReportHistory({
      searchTitle: submittedSearch || undefined,
      limit: PAGE_SIZE,
      offset,
      sortBy,
    })
    setRows(result.rows)
    setTotal(result.total)
    setLoading(false)
  }, [submittedSearch, offset, sortBy])

  useEffect(() => {
    reload()
  }, [reload])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setOffset(0)
    setSubmittedSearch(search.trim())
  }

  async function handleToggleBookmark(sessionId: string) {
    if (!sessionId || bookmarkPending.has(sessionId)) return
    setBookmarkPending((prev) => new Set(prev).add(sessionId))
    const res = await toggleBookmark(sessionId)
    setBookmarkPending((prev) => {
      const next = new Set(prev)
      next.delete(sessionId)
      return next
    })
    if (!res.ok) return
    // 同じ session の全レポート行のしおり状態を一括更新
    setRows((prev) =>
      prev.map((r) => (r.sessionId === sessionId ? { ...r, bookmarked: res.bookmarked } : r))
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-600" />
          レポート履歴
        </h1>
        <Link
          href="/system-admin/advisor"
          className="text-xs text-slate-600 hover:text-slate-900 hover:underline"
        >
          ← Advisor に戻る
        </Link>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="タイトルで検索..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <button
          type="submit"
          className="text-xs px-3 py-1.5 rounded-md bg-slate-800 text-white hover:bg-slate-900"
        >
          検索
        </button>
        {submittedSearch && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setSubmittedSearch('')
              setOffset(0)
            }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            クリア
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5 text-xs">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <label htmlFor="sortBy" className="text-slate-600">並び替え</label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as SortKey)
              setOffset(0)
            }}
            className="border border-slate-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="created_desc">作成日 (新しい順)</option>
            <option value="bookmark_first">しおり付き優先</option>
          </select>
        </div>
      </form>

      <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-2 py-2 w-9" />
              <th className="text-left px-3 py-2 font-medium text-slate-600 w-32">最終更新</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">タイトル</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 w-48">期間</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 w-32">期限</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center text-slate-400">
                  {submittedSearch
                    ? `「${submittedSearch}」に該当するレポートはありません`
                    : 'まだレポートがありません'}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openSession(r.sessionId)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  title="このセッションを開く"
                >
                  <td
                    className="px-2 py-2 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleBookmark(r.sessionId)}
                      disabled={bookmarkPending.has(r.sessionId)}
                      title={
                        r.bookmarked
                          ? 'しおり ON: このセッションのレポートは永続保存されます (クリックで解除)'
                          : 'しおりを付ける (このセッションのレポートを永続保存)'
                      }
                      className={
                        r.bookmarked
                          ? 'text-amber-500 hover:text-amber-600 disabled:opacity-50'
                          : 'text-slate-300 hover:text-amber-500 disabled:opacity-50'
                      }
                    >
                      {r.bookmarked ? (
                        <BookmarkCheck className="h-4 w-4 fill-current" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    {r.title || <span className="text-slate-400">無題</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                    {r.rangeStart && r.rangeEnd ? `${r.rangeStart} 〜 ${r.rangeEnd}` : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <RetentionLabel bookmarked={r.bookmarked} sessionUpdatedAt={r.sessionUpdatedAt} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ページング */}
      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
          <div>
            {total} 件中 {offset + 1} - {Math.min(offset + PAGE_SIZE, total)} 件
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              前へ
            </button>
            <span className="px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function RetentionLabel({
  bookmarked,
  sessionUpdatedAt,
}: {
  bookmarked: boolean
  sessionUpdatedAt: string
}) {
  if (bookmarked) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-medium">
        <BookmarkCheck className="h-3 w-3" />
        永続保存
      </span>
    )
  }
  const updatedMs = new Date(sessionUpdatedAt).getTime()
  if (!updatedMs) return <span className="text-slate-400 font-mono text-[11px]">-</span>
  const expiresMs = updatedMs + RETENTION_DRAFT_DAYS * 24 * 60 * 60 * 1000
  const remainingMs = expiresMs - Date.now()
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
  const expiresDate = new Date(expiresMs).toISOString()
  if (remainingDays <= 0) {
    return (
      <span className="text-red-600 font-mono text-[11px]" title={`期限: ${formatDate(expiresDate)}`}>
        期限切れ
      </span>
    )
  }
  const tone =
    remainingDays <= 7
      ? 'text-red-600'
      : remainingDays <= 14
      ? 'text-amber-600'
      : 'text-slate-600'
  return (
    <span className={`font-mono text-[11px] ${tone}`} title={`削除予定日: ${formatDate(expiresDate)}`}>
      あと {remainingDays} 日
    </span>
  )
}
