'use client'

import { useState } from 'react'
import { Button } from '@/src/components/ui/shadcn/button'

export interface SqlResultTableData {
  tableId: string // "T-001"
  purpose: string
  columns: Array<{ key: string; label: string; type?: string }>
  rows: unknown[][]
  rowCount: number
  truncated: boolean
  durationMs?: number
}

export interface SqlResultTableProps {
  data: SqlResultTableData
  /**
   * 「レポートに送る」ボタン押下時のコールバック。
   * チャット側で hidden hint メッセージを送って add_tables_to_report を呼ぶ。
   */
  onSendToReport?: (tableId: string) => void
  /** ボタンを無効化 (送信中など) */
  sendDisabled?: boolean
}

const PREVIEW_ROWS = 20

/**
 * execute_sql の結果を表として表示する。
 * - ヘッダに表 ID バッジ (T-001) と purpose を表示
 * - 21 行目以降は折りたたみ
 * - [📋 レポートに送る] ボタンを下部に配置
 */
export function SqlResultTable({
  data,
  onSendToReport,
  sendDisabled,
}: SqlResultTableProps) {
  const [expanded, setExpanded] = useState(false)
  const rowsToShow = expanded ? data.rows : data.rows.slice(0, PREVIEW_ROWS)
  const hasMore = data.rows.length > PREVIEW_ROWS

  return (
    <div className="my-3 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2 text-xs dark:border-gray-700">
        <span className="inline-flex items-center rounded bg-blue-600 px-2 py-0.5 font-mono text-white">
          {data.tableId}
        </span>
        <span className="text-gray-700 dark:text-gray-200">{data.purpose}</span>
        <span className="ml-auto text-gray-400 dark:text-gray-500">
          {data.rowCount.toLocaleString('ja-JP')} 行
          {data.truncated ? ' (上限到達)' : ''}
          {typeof data.durationMs === 'number'
            ? ` · ${data.durationMs}ms`
            : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        {data.columns.length === 0 || data.rows.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">データなし</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {data.columns.map((c) => (
                  <th
                    key={c.key}
                    className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsToShow.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-gray-100 dark:border-gray-800"
                >
                  {data.columns.map((c, j) => (
                    <td
                      key={c.key}
                      className="px-3 py-1.5 text-gray-900 dark:text-gray-100"
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
          className="block w-full border-t border-gray-200 px-3 py-2 text-xs text-blue-600 hover:bg-gray-50 dark:border-gray-700 dark:text-blue-400 dark:hover:bg-gray-800"
        >
          残り {data.rows.length - PREVIEW_ROWS} 行を表示
        </button>
      )}
      {expanded && hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="block w-full border-t border-gray-200 px-3 py-2 text-xs text-blue-600 hover:bg-gray-50 dark:border-gray-700 dark:text-blue-400 dark:hover:bg-gray-800"
        >
          表示を折りたたむ
        </button>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-3 py-2 dark:border-gray-700">
        {onSendToReport && (
          <Button
            size="sm"
            variant="outline"
            disabled={sendDisabled}
            onClick={() => onSendToReport(data.tableId)}
          >
            📋 レポートに送る
          </Button>
        )}
      </div>
    </div>
  )
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
