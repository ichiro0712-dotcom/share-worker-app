'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Search, Loader2, FileText, ExternalLink } from 'lucide-react'
import {
  listReportHistory,
  type ClientHistoryRow,
} from '@/src/lib/advisor/actions/report-versions'

const PAGE_SIZE = 50

export function ReportsListClient() {
  const [rows, setRows] = useState<ClientHistoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [offset, setOffset] = useState(0)

  const reload = useCallback(async () => {
    setLoading(true)
    const result = await listReportHistory({
      searchTitle: submittedSearch || undefined,
      limit: PAGE_SIZE,
      offset,
    })
    setRows(result.rows)
    setTotal(result.total)
    setLoading(false)
  }, [submittedSearch, offset])

  useEffect(() => {
    reload()
  }, [reload])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setOffset(0)
    setSubmittedSearch(search.trim())
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

      <form onSubmit={handleSearch} className="mb-4 flex items-center gap-2">
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
      </form>

      <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600 w-32">作成日時</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">タイトル</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 w-48">期間</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 w-12">v</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 w-20">出自</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600 w-20">サイズ</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-slate-400">
                  {submittedSearch
                    ? `「${submittedSearch}」に該当するレポートはありません`
                    : 'まだレポートがありません'}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    <Link
                      href={`/system-admin/advisor/reports/${r.id}`}
                      className="hover:text-slate-900 hover:underline"
                    >
                      {r.title || <span className="text-slate-400">無題</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                    {r.rangeStart && r.rangeEnd ? `${r.rangeStart} 〜 ${r.rangeEnd}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">v{r.versionNumber}</td>
                  <td className="px-3 py-2">
                    <SourceBadge source={r.source} />
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500 font-mono text-[11px]">
                    {(r.resultLength / 1000).toFixed(1)}K
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/system-admin/advisor?c=${encodeURIComponent(r.sessionId)}`}
                      className="text-slate-400 hover:text-slate-700"
                      title="このセッションを開く"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
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

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; color: string }> = {
    generated: { label: '生成', color: 'bg-slate-100 text-slate-700' },
    manual_edit: { label: '手動', color: 'bg-amber-100 text-amber-800' },
    llm_edit: { label: 'AI修正', color: 'bg-blue-100 text-blue-800' },
  }
  const m = map[source] ?? { label: source, color: 'bg-slate-100 text-slate-700' }
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${m.color}`}>
      {m.label}
    </span>
  )
}
