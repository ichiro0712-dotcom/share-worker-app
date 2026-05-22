import { notFound } from 'next/navigation'
import { getSharedTableByToken } from '@/src/lib/advisor/actions/chat-tables'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { token: string }
}

export default async function PublicChatTablePage({ params }: Props) {
  const data = await getSharedTableByToken(params.token)
  if (!data) notFound()

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
        <header className="mb-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-slate-400">共有データ</span>
            <ExpiryBadge sharedUntil={data.sharedUntil} />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
            {data.purpose || `表 ${data.tableId}`}
          </h1>
          <div className="mt-1 text-[11px] text-slate-400">
            {data.tableId} · {data.rowCount.toLocaleString('ja-JP')} 行
            {data.truncated ? ' (上限到達)' : ''} · {formatDate(data.createdAt)}
          </div>
        </header>

        <div className="bg-white rounded-md border border-slate-200 overflow-x-auto">
          {data.columns.length === 0 || data.rows.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">データなし</div>
          ) : (
            <table className="w-full text-sm border-collapse">
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
                {data.rows.map((row, i) => (
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

        <footer className="mt-6 text-center text-[11px] text-slate-400">
          このページは URL を知っている人のみアクセスできます
        </footer>
      </main>
    </div>
  )
}

function ExpiryBadge({ sharedUntil }: { sharedUntil: string }) {
  const remainingMs = new Date(sharedUntil).getTime() - Date.now()
  const remainingDays = Math.max(
    0,
    Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
  )
  const tone =
    remainingDays >= 7
      ? 'bg-slate-50 border-slate-200 text-slate-500'
      : remainingDays >= 1
        ? 'bg-amber-50 border-amber-200 text-amber-700'
        : 'bg-red-50 border-red-200 text-red-700'
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tone}`}>
      公開期限: あと {remainingDays} 日
    </span>
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

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
  } catch {
    return iso
  }
}
