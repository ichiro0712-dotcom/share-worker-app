'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Copy, Check, Share2, ChevronDown, ChevronRight, Code } from 'lucide-react'
import {
  enableTableShare,
  disableTableShare,
  getTableShareState,
} from '@/src/lib/advisor/actions/chat-tables'

export interface SqlResultTableData {
  /** 表示用 ID ("T-001") */
  tableId: string
  /** DB 上の数値 ID (共有 Server Action で使う) */
  tableDbId: number
  purpose: string
  columns: Array<{ key: string; label: string; type?: string }>
  rows: unknown[][]
  rowCount: number
  truncated: boolean
  durationMs?: number
  /**
   * 実行された SELECT 文。
   * 「あとで振り返って SQL の中身を見たい」というユーザー要望を受けて追加。
   * 折りたたみ UI でデフォルト非表示、クリックで展開。
   * 未指定 (旧データ) の場合は折りたたみボタン自体を出さない。
   */
  sqlText?: string
}

export interface SqlResultTableProps {
  data: SqlResultTableData
  /** [📋 レポートに送る] 押下時のコールバック */
  onSendToReport?: (tableId: string) => void
  /** ボタン無効化 (送信中など) */
  sendDisabled?: boolean
}

const PREVIEW_ROWS = 20

/**
 * execute_sql の結果を表として表示する。
 * デザインは既存の MarkdownTable に揃える (slate ベース、border + bg-white)。
 *
 * 表ヘッダは最小限 (表 ID クリック可・行数・所要時間)。
 * 共有ボタンはドロップダウンで Sheets コピー / レポート送信 / URL 共有 を提供。
 */
export function SqlResultTable({
  data,
  onSendToReport,
  sendDisabled,
}: SqlResultTableProps) {
  const tableRef = useRef<HTMLTableElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [tableIdCopied, setTableIdCopied] = useState(false)
  const [sqlOpen, setSqlOpen] = useState(false)
  const [sqlCopied, setSqlCopied] = useState(false)
  const rowsToShow = expanded ? data.rows : data.rows.slice(0, PREVIEW_ROWS)
  const hasMore = data.rows.length > PREVIEW_ROWS
  const hasSql = !!(data.sqlText && data.sqlText.trim().length > 0)

  function handleCopyTableId() {
    navigator.clipboard.writeText(data.tableId).catch(() => {
      /* ignore */
    })
    setTableIdCopied(true)
    setTimeout(() => setTableIdCopied(false), 1500)
  }

  function handleCopySql() {
    if (!data.sqlText) return
    navigator.clipboard.writeText(data.sqlText).catch(() => {
      /* ignore */
    })
    setSqlCopied(true)
    setTimeout(() => setSqlCopied(false), 1500)
  }

  return (
    <div className="my-3">
      {/* SQL 折り畳み (sqlText がある場合のみ表示)。
          ユーザー要望: 承認モーダルだけだとリロード後に SQL を見返せないので、
          表カード自体に「使った SQL」を畳んで持たせる。 */}
      {hasSql && (
        <div className="mb-1.5">
          <button
            type="button"
            onClick={() => setSqlOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800"
            title={sqlOpen ? '実行された SQL を畳む' : '実行された SQL を表示'}
          >
            {sqlOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Code className="h-3 w-3" />
            <span>{sqlOpen ? '実行 SQL を畳む' : '実行 SQL を表示'}</span>
          </button>
          {sqlOpen && (
            <div className="mt-1 rounded-md border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200 text-[10px] text-slate-500">
                <span className="truncate" title={data.purpose}>
                  目的: {data.purpose || '(未指定)'}
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100"
                  title="SQL をコピー"
                >
                  {sqlCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{sqlCopied ? 'コピー済' : 'SQL コピー'}</span>
                </button>
              </div>
              <pre className="px-3 py-2 text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap break-words font-mono overflow-x-auto">
                {data.sqlText}
              </pre>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        {data.columns.length === 0 || data.rows.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">データなし</div>
        ) : (
          <table ref={tableRef} className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {data.columns.map((c) => (
                  <th
                    key={c.key}
                    className="text-left py-2 px-3 font-medium text-slate-700 bg-slate-50 border-b border-slate-200"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsToShow.map((row, i) => (
                <tr key={i}>
                  {data.columns.map((c, j) => (
                    <td
                      key={c.key}
                      className="py-2 px-3 text-slate-700 border-b border-slate-100"
                    >
                      {formatCell(row[j])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="block w-full mt-1 text-[10px] text-blue-600 hover:underline text-center"
        >
          残り {data.rows.length - PREVIEW_ROWS} 行を表示
        </button>
      )}
      {expanded && hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="block w-full mt-1 text-[10px] text-blue-600 hover:underline text-center"
        >
          表示を折りたたむ
        </button>
      )}

      {/* 表下のメタ + 共有ボタン (既存 MarkdownTable の Sheets ボタンと同じ並び) */}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <button
            type="button"
            onClick={handleCopyTableId}
            className="font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            title="表 ID をコピー"
          >
            {tableIdCopied ? '✓ コピー済' : data.tableId}
          </button>
          <span>{data.rowCount.toLocaleString('ja-JP')} 行</span>
          {data.truncated && <span className="text-amber-600">上限到達</span>}
          {typeof data.durationMs === 'number' && (
            <span>{data.durationMs}ms</span>
          )}
        </div>
        <ShareMenu
          tableRef={tableRef}
          tableId={data.tableId}
          tableDbId={data.tableDbId}
          onSendToReport={onSendToReport}
          sendDisabled={sendDisabled}
        />
      </div>
    </div>
  )
}

// ---- 共有ボタン (ドロップダウン) ------------------------------------------

interface ShareMenuProps {
  tableRef: React.RefObject<HTMLTableElement | null>
  tableId: string
  tableDbId: number
  onSendToReport?: (tableId: string) => void
  sendDisabled?: boolean
}

function ShareMenu({
  tableRef,
  tableId,
  tableDbId,
  onSendToReport,
  sendDisabled,
}: ShareMenuProps) {
  const [open, setOpen] = useState(false)
  const [sheetsCopied, setSheetsCopied] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)
  const [urlLoading, setUrlLoading] = useState(false)
  const [shareState, setShareState] = useState<{
    shared: boolean
    token: string | null
    sharedUntil: string | null
  } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (
        menuRef.current &&
        e.target instanceof Node &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // 開いた時に現在の共有状態をフェッチ
  useEffect(() => {
    if (!open || shareState !== null) return
    getTableShareState(tableDbId)
      .then((res) => {
        if (res.ok) {
          setShareState({
            shared: res.state.shared,
            token: res.state.token,
            sharedUntil: res.state.sharedUntil,
          })
        }
      })
      .catch(() => {
        /* ignore */
      })
  }, [open, tableDbId, shareState])

  const handleSheets = useCallback(async () => {
    const table = tableRef.current
    if (!table) return
    const tsv = tableToTsv(table)
    try {
      await navigator.clipboard.writeText(tsv)
      setSheetsCopied(true)
      setTimeout(() => setSheetsCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [tableRef])

  const handleShareUrl = useCallback(async () => {
    setUrlLoading(true)
    try {
      const res = await enableTableShare(tableDbId)
      if (!res.ok) {
        alert(`共有 URL 発行に失敗: ${res.reason}`)
        return
      }
      const url = `${window.location.origin}/advisor/t/${res.token}`
      await navigator.clipboard.writeText(url)
      setShareState({
        shared: true,
        token: res.token,
        sharedUntil: res.sharedUntil,
      })
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2500)
    } finally {
      setUrlLoading(false)
    }
  }, [tableDbId])

  const handleDisableShare = useCallback(async () => {
    if (!confirm('この表の共有 URL を停止しますか?')) return
    await disableTableShare(tableDbId)
    setShareState({ shared: false, token: null, sharedUntil: null })
  }, [tableDbId])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-[10px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors"
        title="共有"
      >
        <Share2 className="h-3 w-3" />
        <span>共有</span>
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-60 rounded-md border border-slate-200 bg-white shadow-lg py-1 z-10">
          <MenuItem
            onClick={handleSheets}
            disabled={false}
            label={sheetsCopied ? 'コピーしました' : 'Sheets にコピー'}
            icon={sheetsCopied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
            sub="表を TSV 形式でクリップボードへ"
          />
          {onSendToReport && (
            <MenuItem
              onClick={() => {
                onSendToReport(tableId)
                setOpen(false)
              }}
              disabled={sendDisabled}
              label="レポートに送る"
              icon={<span className="text-[12px]">📋</span>}
              sub="Canvas のレポートドラフトに追記"
            />
          )}
          <div className="border-t border-slate-100 my-1" />
          {shareState?.shared ? (
            <>
              <MenuItem
                onClick={async () => {
                  if (!shareState.token) return
                  const url = `${window.location.origin}/advisor/t/${shareState.token}`
                  await navigator.clipboard.writeText(url)
                  setUrlCopied(true)
                  setTimeout(() => setUrlCopied(false), 2500)
                }}
                disabled={false}
                label={urlCopied ? 'URL コピーしました' : 'URL をコピー'}
                icon={urlCopied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                sub={
                  shareState.sharedUntil
                    ? `期限: ${formatRemaining(shareState.sharedUntil)}`
                    : '共有中'
                }
              />
              <MenuItem
                onClick={handleDisableShare}
                disabled={false}
                label="共有 URL を停止"
                icon={<span className="text-[12px]">⏹</span>}
                sub="URL を無効化"
              />
            </>
          ) : (
            <MenuItem
              onClick={handleShareUrl}
              disabled={urlLoading}
              label={urlLoading ? '発行中...' : 'URL で共有 (30 日)'}
              icon={<span className="text-[12px]">🔗</span>}
              sub="URL を発行してコピー"
            />
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  onClick,
  disabled,
  label,
  icon,
  sub,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  icon: React.ReactNode
  sub?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-start gap-2 px-3 py-2 text-left text-[11px] hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
    >
      <span className="mt-0.5">{icon}</span>
      <span>
        <span className="block text-slate-800">{label}</span>
        {sub && <span className="block text-[10px] text-slate-400">{sub}</span>}
      </span>
    </button>
  )
}

function tableToTsv(table: HTMLTableElement): string {
  const lines: string[] = []
  for (const row of Array.from(table.rows)) {
    const cells: string[] = []
    for (const cell of Array.from(row.cells)) {
      const text = (cell.textContent ?? '')
        .replace(/\r?\n/g, ' ')
        .replace(/\t/g, ' ')
        .trim()
      cells.push(text)
    }
    lines.push(cells.join('\t'))
  }
  return lines.join('\n')
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '-'
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v.toLocaleString('ja-JP')
    return v.toLocaleString('ja-JP', { maximumFractionDigits: 4 })
  }
  if (typeof v === 'boolean') return v ? '○' : '×'
  return String(v)
}

function formatRemaining(sharedUntil: string): string {
  const ms = new Date(sharedUntil).getTime() - Date.now()
  if (ms <= 0) return '期限切れ'
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000))
  return `あと ${days} 日`
}
