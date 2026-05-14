'use client'

import { useRef, useState, useCallback, type ReactNode } from 'react'
import { Copy, Check } from 'lucide-react'

/**
 * Markdown table をレンダリングしつつ、右下にスプレッドシートコピーボタンを表示する。
 *
 * 使い方: react-markdown の `components.table` プロパティに本コンポーネントを渡す。
 *
 * コピー仕様:
 *   - TSV (タブ区切り) でクリップボードへ書き込む
 *   - Google Sheets / Excel に直接ペースト可能
 */
export function MarkdownTable({ children }: { children?: ReactNode }) {
  const tableRef = useRef<HTMLTableElement | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const table = tableRef.current
    if (!table) return
    const tsv = tableToTsv(table)
    try {
      await navigator.clipboard.writeText(tsv)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // フォールバック: 古いブラウザ用
      const ta = document.createElement('textarea')
      ta.value = tsv
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } finally {
        document.body.removeChild(ta)
      }
    }
  }, [])

  return (
    <div className="my-3">
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table
          ref={tableRef}
          className="w-full text-xs border-collapse"
        >
          {children}
        </table>
      </div>
      {/* ボタンは表の下、右寄せ。常時表示で表の中身を隠さない。 */}
      <div className="flex justify-end mt-1.5">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 text-[10px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors"
          title="スプレッドシートにコピー (TSV 形式)"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-green-600">Sheets</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Sheets</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/**
 * <table> 要素を TSV 文字列に変換する。
 * - 各セル内の改行・タブをスペースに置換 (TSV 仕様上必須)
 * - thead と tbody の両方をフラットに走査
 */
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

/** Markdown テーブル子要素のスタイル付き wrapper */
export function MarkdownTh({ children }: { children?: ReactNode }) {
  return (
    <th className="text-left py-2 px-3 font-medium text-slate-700 bg-slate-50 border-b border-slate-200">
      {children}
    </th>
  )
}

export function MarkdownTd({ children }: { children?: ReactNode }) {
  return (
    <td className="py-2 px-3 text-slate-700 border-b border-slate-100">
      {children}
    </td>
  )
}

export function MarkdownThead({ children }: { children?: ReactNode }) {
  return <thead>{children}</thead>
}

export function MarkdownTbody({ children }: { children?: ReactNode }) {
  return <tbody>{children}</tbody>
}

export function MarkdownTr({ children }: { children?: ReactNode }) {
  return <tr>{children}</tr>
}
