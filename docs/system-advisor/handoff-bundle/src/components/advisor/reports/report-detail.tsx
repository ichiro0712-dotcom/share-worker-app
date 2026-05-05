'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check, Trash2, ExternalLink, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'

const MARKDOWN_COMPONENTS = {
  ul: ({ children, ...props }: { children?: React.ReactNode }) => (
    <ul {...props} className="list-disc list-outside pl-5 my-2 space-y-1 marker:text-slate-400">{children}</ul>
  ),
  ol: ({ children, ...props }: { children?: React.ReactNode }) => (
    <ol {...props} className="list-decimal list-outside pl-5 my-2 space-y-1 marker:text-slate-400">{children}</ol>
  ),
  li: ({ children, ...props }: { children?: React.ReactNode }) => (
    <li {...props} className="leading-relaxed">{children}</li>
  ),
  table: ({ children, ...props }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-3">
      <table {...props} className="text-xs border border-slate-200 border-collapse">{children}</table>
    </div>
  ),
  th: ({ children, ...props }: { children?: React.ReactNode }) => (
    <th {...props} className="bg-slate-50 px-2 py-1 border border-slate-200 text-left font-semibold">{children}</th>
  ),
  td: ({ children, ...props }: { children?: React.ReactNode }) => (
    <td {...props} className="px-2 py-1 border border-slate-200">{children}</td>
  ),
}
import {
  deleteVersion,
  type ClientVersionDetail,
} from '@/src/lib/advisor/actions/report-versions'

interface Props {
  initial: ClientVersionDetail
}

export function ReportDetailClient({ initial }: Props) {
  const router = useRouter()
  const [version] = useState(initial)
  const [copied, setCopied] = useState(false)
  const [showSnapshot, setShowSnapshot] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function handleCopy() {
    navigator.clipboard.writeText(version.resultMarkdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDelete() {
    if (!confirm(`v${version.versionNumber} を削除しますか? 取り消せません`)) return
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteVersion(version.id)
    setDeleting(false)
    if (!result.ok) {
      setDeleteError(result.reason ?? '削除に失敗しました')
      return
    }
    router.push('/system-admin/advisor/reports')
  }

  const snap = version.draftSnapshot

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4 text-xs">
        <Link
          href="/system-admin/advisor/reports"
          className="text-slate-600 hover:text-slate-900 hover:underline"
        >
          ← 履歴一覧に戻る
        </Link>
        <Link
          href={`/system-admin/advisor?c=${encodeURIComponent(initial.draftId)}`}
          className="flex items-center gap-1 text-slate-600 hover:text-slate-900 hover:underline"
        >
          このセッションを開く
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* タイトル */}
      <h1 className="text-xl font-semibold text-slate-800 mb-1">
        {snap.title || '無題のレポート'}
      </h1>
      <div className="text-xs text-slate-500 mb-4 flex items-center gap-3 flex-wrap">
        <span>v{version.versionNumber}</span>
        <span>·</span>
        <span>{formatDateTime(version.createdAt)}</span>
        <span>·</span>
        <span>{sourceLabel(version.source)}</span>
        <span>·</span>
        <span>{version.resultModel}</span>
        {snap.rangeStart && snap.rangeEnd && (
          <>
            <span>·</span>
            <span className="font-mono">
              {snap.rangeStart} 〜 {snap.rangeEnd}
            </span>
          </>
        )}
      </div>

      {/* アクション */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 flex items-center gap-1.5"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? 'コピー済み' : 'コピー'}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-red-50 hover:text-red-700 hover:border-red-200 flex items-center gap-1.5 ml-auto"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleting ? '削除中...' : '削除'}
        </button>
      </div>

      {deleteError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* 本文 */}
      <div className="rounded-md border border-slate-200 bg-white p-6">
        <div className="prose prose-sm prose-neutral max-w-none [&_h1]:text-base [&_h2]:text-sm [&_h2]:font-semibold [&_code]:text-xs [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{version.resultMarkdown}</ReactMarkdown>
        </div>
      </div>

      {/* ドラフトスナップショット */}
      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50/50">
        <button
          type="button"
          onClick={() => setShowSnapshot(!showSnapshot)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100/50"
        >
          <span>ドラフトスナップショット (生成時の要件)</span>
          {showSnapshot ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {showSnapshot && (
          <div className="px-4 pb-3 pt-1 space-y-2 text-xs">
            <SnapField label="タイトル" value={snap.title} />
            <SnapField label="目的" value={snap.goal} />
            <SnapField
              label="期間"
              value={snap.rangeStart && snap.rangeEnd ? `${snap.rangeStart} 〜 ${snap.rangeEnd}` : null}
            />
            <SnapField
              label="データソース"
              value={snap.dataSources.length ? snap.dataSources.join(', ') : null}
            />
            {snap.dataSources.includes('query_metric') && (
              <SnapField
                label="取得指標"
                value={snap.metricKeys.length ? snap.metricKeys.join(', ') : '(未指定)'}
              />
            )}
            <SnapField label="アウトライン" value={snap.outline} multiline />
            <SnapField label="メモ" value={snap.notes} multiline />
            {(version.inputTokens != null || version.outputTokens != null) && (
              <div className="pt-2 mt-2 border-t border-slate-200 text-[11px] text-slate-500 font-mono">
                tokens in/out:{' '}
                {version.inputTokens ?? '-'} / {version.outputTokens ?? '-'}
                {version.generatedMs != null && ` · ${(version.generatedMs / 1000).toFixed(1)}s`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SnapField({
  label,
  value,
  multiline,
}: {
  label: string
  value: string | null
  multiline?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      {value ? (
        <div className={`text-slate-700 ${multiline ? 'whitespace-pre-wrap' : ''}`}>
          {value}
        </div>
      ) : (
        <div className="text-slate-400">未指定</div>
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

function sourceLabel(source: string): string {
  switch (source) {
    case 'generated':
      return '自動生成'
    case 'manual_edit':
      return '手動編集'
    case 'llm_edit':
      return 'AI 部分修正'
    default:
      return source
  }
}
