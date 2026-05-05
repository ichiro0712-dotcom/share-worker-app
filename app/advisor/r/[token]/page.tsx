import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { normalizeMarkdown } from '@/src/lib/advisor/markdown-normalize'
import { getVersionByShareToken } from '@/src/lib/advisor/persistence/report-versions'
import { getDraftById } from '@/src/lib/advisor/persistence/report-drafts'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { token: string }
}

const MARKDOWN_COMPONENTS = {
  em: ({ children, ...props }: { children?: React.ReactNode }) => {
    const text = typeof children === 'string'
      ? children
      : Array.isArray(children) && typeof children[0] === 'string'
        ? children[0]
        : ''
    if (text.startsWith('出典:') || text.startsWith('出典 :')) {
      return (
        <em
          {...props}
          className="block text-[11px] text-slate-400 mt-1 mb-2 not-italic"
        >
          {children}
        </em>
      )
    }
    return <em {...props}>{children}</em>
  },
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
      <table {...props} className="text-sm border border-slate-200 border-collapse">{children}</table>
    </div>
  ),
  th: ({ children, ...props }: { children?: React.ReactNode }) => (
    <th {...props} className="bg-slate-50 px-3 py-1.5 border border-slate-200 text-left font-semibold">{children}</th>
  ),
  td: ({ children, ...props }: { children?: React.ReactNode }) => (
    <td {...props} className="px-3 py-1.5 border border-slate-200">{children}</td>
  ),
}

export default async function PublicReportPage({ params }: Props) {
  const version = await getVersionByShareToken(params.token)
  if (!version) {
    notFound()
  }

  const draft = await getDraftById(version.draftId)
  const title = draft?.title ?? version.draftSnapshot.title ?? 'レポート'
  const range = formatRange(version.draftSnapshot.rangeStart, version.draftSnapshot.rangeEnd)

  // 共有者 (admin) 情報。draft.adminId が共有者 = レポート作成者。
  // メールは個人情報扱いなので公開ページには出さず、name のみ。
  let sharerName: string | null = null
  if (draft?.adminId) {
    const admin = await prisma.systemAdmin.findUnique({
      where: { id: draft.adminId },
      select: { name: true },
    })
    sharerName = admin?.name ?? null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        <header className="mb-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-slate-400">共有レポート</span>
            {version.sharedUntil && (
              <ExpiryBadge sharedUntil={version.sharedUntil} />
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{title}</h1>
          {range && (
            <div className="mt-2 text-xs text-slate-500">対象期間: {range} (JST)</div>
          )}
          <div className="mt-1 text-[11px] text-slate-400">
            v{version.versionNumber} · {formatDate(version.createdAt)}
            {sharerName && <> · 共有: {sharerName}</>}
          </div>
        </header>

        <article className="bg-white rounded-md border border-slate-200 p-5 sm:p-8 text-sm sm:text-[15px] leading-relaxed text-slate-800 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-0 [&_h1]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_p]:my-2 [&_code]:text-xs [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
            {normalizeMarkdown(version.resultMarkdown)}
          </ReactMarkdown>
        </article>

        <footer className="mt-6 text-center text-[11px] text-slate-400 space-y-1">
          {sharerName && version.sharedAt && (
            <div>
              {sharerName} さんが {formatDate(version.sharedAt)} に共有
            </div>
          )}
          <div>このページは URL を知っている人のみアクセスできます</div>
        </footer>
      </main>
    </div>
  )
}

function ExpiryBadge({ sharedUntil }: { sharedUntil: string }) {
  const remainingMs = new Date(sharedUntil).getTime() - Date.now()
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
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

function formatRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null
  if (start && end) return `${start} 〜 ${end}`
  return start ?? end ?? null
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
