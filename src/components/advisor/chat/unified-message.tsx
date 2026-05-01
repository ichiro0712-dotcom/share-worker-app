'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { Copy, Check, Loader2, FolderOpen, Download, X, ChevronLeft, ChevronRight, Bot, type LucideIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/shadcn/button'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  MarkdownTable,
  MarkdownTh,
  MarkdownTd,
  MarkdownThead,
  MarkdownTbody,
  MarkdownTr,
} from '@/src/components/advisor/chat/markdown-table'
import { resolveToolSource, CATEGORY_BADGE, type AdvisorSourceCategory } from '@/src/lib/advisor/tool-source-labels'

// --- ファイルパス・URLリンク化 ---

/** ローカルファイルをFinderで開く */
function openLocalFile(path: string) {
  fetch('/api/openclaw/open-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
}

/** テキスト内のファイルパス（~/...）を検出してクリック可能にする */
function LinkifyContent({ children }: { children: ReactNode }) {
  if (!children) return <>{children}</>

  const processNode = (node: ReactNode): ReactNode => {
    if (typeof node !== 'string') return node

    // ~/で始まるファイルパスを検出
    const filePathRegex = /(~\/[^\s,;。、）]+)/g
    const parts = node.split(filePathRegex)

    if (parts.length === 1) return node

    return parts.map((part, i) => {
      if (filePathRegex.test(part)) {
        // ファイルパスリセット（lastIndexリセット）
        filePathRegex.lastIndex = 0
        return (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); openLocalFile(part) }}
            className="inline-flex items-center gap-0.5 text-blue-600 hover:underline cursor-pointer font-normal"
            title="Finderで開く"
          >
            <FolderOpen className="inline h-3 w-3" />
            {part}
          </button>
        )
      }
      return part
    })
  }

  // childrenが配列の場合は各要素を処理
  if (Array.isArray(children)) {
    return <>{children.map((child, i) => <span key={i}>{processNode(child)}</span>)}</>
  }

  return <>{processNode(children)}</>
}

// --- 型定義 ---

export interface UnifiedMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
  agentLabel?: string
  actionIds?: string[]
  choices?: ChoiceGroup[]
  images?: string[]    // data URI形式の画像
  videos?: string[]    // data URI形式の動画
  /**
   * この回答を作る際に Advisor が呼んだツール名のリスト。
   * 「参照したデータソース」セクションを描画するために使う。
   * 同じツールが複数回呼ばれた場合は呼び出し回数分そのまま入れて構わない (UI 側で重複排除)。
   */
  sources?: string[]
}

export interface ChoiceGroup {
  id: string
  type: 'single' | 'multiple'
  label: string
  options: string[]
}

export interface ActionStatus {
  status: 'pending' | 'executing' | 'done' | 'failed'
  result?: Record<string, string>
}

interface UnifiedMessageProps {
  message: UnifiedMessage
  isStreaming?: boolean
  /** アシスタントアイコン（デフォルト: なし→丸アイコン） */
  assistantIcon?: { Icon: LucideIcon; colorClass: string }
  /** アクション承認コールバック */
  onApproveAction?: (actionId: string) => Promise<void>
  /** アクションの状態マップ */
  actionStatuses?: Record<string, ActionStatus>
  /** 選択肢が確定されたときのコールバック（メッセージとして送信） */
  onChoiceSubmit?: (choiceGroupId: string, selected: string[]) => void
  /** 確定済みの選択肢 */
  submittedChoices?: Record<string, string[]>
}

// --- メインコンポーネント ---

export function UnifiedMessage({
  message,
  isStreaming,
  assistantIcon,
  onApproveAction,
  actionStatuses = {},
  onChoiceSubmit,
  submittedChoices = {},
}: UnifiedMessageProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ユーザーメッセージ
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-slate-800 text-white px-4 py-2.5 rounded-2xl rounded-br-md">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  // アシスタントメッセージ
  const hasActions = (message.actionIds?.length ?? 0) > 0
  const hasChoices = (message.choices?.length ?? 0) > 0

  return (
    <div className="group flex justify-start">
      <div className="flex gap-2.5 max-w-[85%]">
        {/* アイコン (デフォルトは System Advisor の Bot) */}
        {assistantIcon ? (
          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${assistantIcon.colorClass}`}>
            <assistantIcon.Icon className="h-3 w-3" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-md bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5">
            <Bot className="h-3.5 w-3.5" />
          </div>
        )}

        <div className="min-w-0 space-y-1">
          {/* エージェントラベル */}
          {message.agentLabel && (
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {message.agentLabel}
            </span>
          )}

          {/* Markdown本文（単一改行を保持）+ 動画マーカー対応 */}
          <div className="text-sm leading-relaxed prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h2]:font-semibold [&_h3]:font-medium [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
            {(() => {
              // [VIDEO:...] マーカーを分離して個別レンダリング
              const videoParts = message.content.split(/\[VIDEO:(.*?)\]/)
              return videoParts.map((part, idx) => {
                if (idx % 2 === 1) {
                  // 奇数インデックス = 動画URL
                  return (
                    <div key={idx} className="relative inline-block my-2 group">
                      <video controls className="rounded-lg max-w-full max-h-96 shadow-sm">
                        <source src={part} />
                      </video>
                      <a
                        href={part}
                        download={`generated-video-${Date.now()}.mp4`}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                        title="ダウンロード"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  )
                }
                if (!part.trim()) return null
                return (
                  <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]} components={{
                    p: ({ children }) => <p><LinkifyContent>{children}</LinkifyContent></p>,
                    li: ({ children }) => <li><LinkifyContent>{children}</LinkifyContent></li>,
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {children}
                      </a>
                    ),
                    // GFM table を綺麗に表示し、右下にスプレッドシートコピーボタンを表示
                    table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,
                    thead: ({ children }) => <MarkdownThead>{children}</MarkdownThead>,
                    tbody: ({ children }) => <MarkdownTbody>{children}</MarkdownTbody>,
                    tr: ({ children }) => <MarkdownTr>{children}</MarkdownTr>,
                    th: ({ children }) => <MarkdownTh>{children}</MarkdownTh>,
                    td: ({ children }) => <MarkdownTd>{children}</MarkdownTd>,
                    img: ({ src, alt }) => {
                      if (!src || typeof src !== 'string') return null
                      const imgSrc = src as string
                      return (
                        <div className="relative inline-block my-2 group">
                          <img src={imgSrc} alt={alt ?? ''} className="rounded-lg max-w-full max-h-96 shadow-sm" loading="lazy" />
                          <a
                            href={imgSrc}
                            download={`generated-image-${Date.now()}.png`}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                            title="ダウンロード"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      )
                    },
                  }}>{part.replace(/(?<!\n)\n(?!\n)/g, '  \n')}</ReactMarkdown>
                )
              })
            })()}
          </div>

          {/* 画像表示（Geminiスタイル: グリッド + クリックで拡大） */}
          {message.images && message.images.length > 0 && (
            <MediaGrid items={message.images} type="image" />
          )}

          {/* 動画表示 */}
          {message.videos && message.videos.length > 0 && (
            <MediaGrid items={message.videos} type="video" />
          )}

          {/* アクション承認ボタン */}
          {hasActions && (
            <div className="flex flex-wrap gap-2 mt-3">
              {message.actionIds!.map(actionId => (
                <ActionButton
                  key={actionId}
                  actionId={actionId}
                  status={actionStatuses[actionId]?.status ?? 'pending'}
                  result={actionStatuses[actionId]?.result}
                  onApprove={onApproveAction}
                />
              ))}
            </div>
          )}

          {/* 選択肢ボタン */}
          {hasChoices && (
            <div className="space-y-3 mt-3">
              {message.choices!.map(group => (
                <ChoiceButtons
                  key={group.id}
                  group={group}
                  submitted={submittedChoices[group.id] ?? null}
                  onSubmit={(selected) => onChoiceSubmit?.(group.id, selected)}
                />
              ))}
            </div>
          )}

          {/* 参照したデータソース */}
          {!isStreaming && message.sources && message.sources.length > 0 && (
            <SourceList sources={message.sources} />
          )}

          {/* コピーボタン */}
          {!isStreaming && !hasActions && !hasChoices && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mt-1"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'コピーしました' : 'コピー'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// --- 参照したデータソース表示 ---

const CATEGORY_COLOR: Record<AdvisorSourceCategory, string> = {
  'tastas-db': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  codebase: 'bg-slate-100 text-slate-700 border-slate-200',
  github: 'bg-slate-900 text-white border-slate-900',
  docs: 'bg-amber-50 text-amber-800 border-amber-200',
  vercel: 'bg-black text-white border-black',
  supabase: 'bg-green-50 text-green-700 border-green-200',
  ga4: 'bg-orange-50 text-orange-700 border-orange-200',
  'search-console': 'bg-blue-50 text-blue-700 border-blue-200',
  line: 'bg-green-100 text-green-800 border-green-300',
  lstep: 'bg-purple-50 text-purple-700 border-purple-200',
  other: 'bg-slate-50 text-slate-600 border-slate-200',
}

function SourceList({ sources }: { sources: string[] }) {
  // ツール名 → 表示エントリに変換し、同一ツールは 1 行にまとめる (呼び出し回数表示)
  const counts = new Map<string, number>()
  for (const name of sources) counts.set(name, (counts.get(name) ?? 0) + 1)

  const entries = Array.from(counts.entries()).map(([toolName, count]) => {
    const resolved = resolveToolSource(toolName)
    return { toolName, count, ...resolved }
  })

  return (
    <div className="mt-3 pt-2 border-t border-slate-200">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        参照したデータソース
      </div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(({ toolName, count, label, category }) => (
          <span
            key={toolName}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${CATEGORY_COLOR[category]}`}
            title={toolName}
          >
            <span className="font-semibold">{CATEGORY_BADGE[category]}</span>
            <span className="text-[10px] opacity-80">·</span>
            <span>{label}</span>
            {count > 1 && <span className="text-[10px] opacity-70">×{count}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

// --- アクション承認ボタン ---

function ActionButton({
  actionId,
  status,
  result,
  onApprove,
}: {
  actionId: string
  status: 'pending' | 'executing' | 'done' | 'failed'
  result?: Record<string, string>
  onApprove?: (id: string) => Promise<void>
}) {
  return (
    <div className="space-y-1.5">
      <Button
        size="sm"
        variant={status === 'done' ? 'secondary' : status === 'failed' ? 'destructive' : 'default'}
        disabled={status !== 'pending'}
        onClick={() => onApprove?.(actionId)}
        className="text-xs"
      >
        {status === 'pending' && '承認する'}
        {status === 'executing' && <><Loader2 className="h-3 w-3 animate-spin mr-1" />実行中...</>}
        {status === 'done' && '実行済み ✓'}
        {status === 'failed' && '失敗'}
      </Button>
      {status === 'done' && result?.meetUrl && (
        <div className="text-xs text-muted-foreground">
          Meet: <a href={result.meetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{result.meetUrl}</a>
        </div>
      )}
    </div>
  )
}

// --- 選択肢ボタン ---

function ChoiceButtons({
  group,
  submitted,
  onSubmit,
}: {
  group: ChoiceGroup
  submitted: string[] | null  // null=未確定、[]以上=確定済み
  onSubmit: (selected: string[]) => void
}) {
  const isSingle = group.type === 'single'
  const isSubmitted = submitted !== null
  const [pending, setPending] = useState<string[]>([])

  function handleClick(option: string) {
    if (isSubmitted) return

    if (isSingle) {
      // single: 即確定＝即送信
      onSubmit([option])
    } else {
      // multiple: トグル（まだ送信しない）
      setPending(prev =>
        prev.includes(option) ? prev.filter(s => s !== option) : [...prev, option]
      )
    }
  }

  function handleConfirm() {
    if (pending.length > 0) {
      onSubmit(pending)
    }
  }

  const displaySelected = isSubmitted ? submitted : pending

  return (
    <div>
      {group.label && (
        <p className="text-xs text-muted-foreground mb-2">{group.label}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {group.options.map((option, i) => {
          const isSelected = displaySelected.includes(option)
          return (
            <button
              key={i}
              onClick={() => handleClick(option)}
              disabled={isSubmitted && !isSelected}
              className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                isSelected
                  ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                  : isSubmitted
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:border-slate-300 hover:bg-muted/50'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
      {/* multiple用: 確定して回答ボタン */}
      {!isSingle && !isSubmitted && pending.length > 0 && (
        <Button
          size="sm"
          className="mt-3 text-xs gap-1.5"
          onClick={handleConfirm}
        >
          {pending.length}件を選択して回答する
        </Button>
      )}
      {/* 確定済み表示 */}
      {isSubmitted && (
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {isSingle ? '選択済み' : `${submitted.length}件選択済み`}
        </p>
      )}
    </div>
  )
}

// --- ユーティリティ: テキストから選択肢タグを抽出 ---

export function parseChoices(content: string): { cleanContent: string; choices: ChoiceGroup[] } {
  const choices: ChoiceGroup[] = []
  const cleanContent = content.replace(
    /\[CHOICES(?:\s+type="(single|multiple)")?(?:\s+label="([^"]*)")?\]\n?([\s\S]*?)(?:\[\/CHOICES\]|$)/g,
    (_match, type, label, body) => {
      const options = body.trim().split('\n')
        .map((line: string) => line.trim())
        .map((line: string) => line.replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, ''))  // 行頭の - • * 1. 2) 等を除去
        .filter(Boolean)
      if (options.length > 0) {
        choices.push({
          id: `choice-${crypto.randomUUID()}`,
          type: (type as 'single' | 'multiple') ?? 'single',
          label: label ?? '',
          options,
        })
      }
      return '' // テキストから除去
    }
  ).trim()

  return { cleanContent, choices }
}

// --- ユーティリティ: 全タグをクリーン ---

export function cleanMessageTags(content: string): string {
  return content
    .replace(/\[SAVE_ACTION\][\s\S]*?\[\/SAVE_ACTION\]/g, '')
    .replace(/\[CHOICES[\s\S]*?\[\/CHOICES\]/g, '')
    .replace(/<!-- FOCUS_PROJECT:.+? -->/g, '')
    // 旧形式タグは廃止済み（新形式: [SAVE_ACTION], [SAVE_LOG]に統一）
    .replace(/\[SAVE_LOG\][\s\S]*?\[\/SAVE_LOG\]/g, '')
    .replace(/\[CANVAS_UPDATE\][\s\S]*?\[\/CANVAS_UPDATE\]/g, '')
    .replace(/^思考プロセス:[\s\S]*?(?=\n[^\n])/m, '')
    .trim()
}

// --- メディアグリッド + ライトボックス（Geminiスタイル） ---

function MediaGrid({ items, type }: { items: string[]; type: 'image' | 'video' }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index)
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
  }, [])

  const goNext = useCallback(() => {
    setLightboxIndex(prev => prev !== null ? (prev + 1) % items.length : null)
  }, [items.length])

  const goPrev = useCallback(() => {
    setLightboxIndex(prev => prev !== null ? (prev - 1 + items.length) % items.length : null)
  }, [items.length])

  function handleDownload(src: string, index: number) {
    const ext = type === 'video' ? 'mp4' : 'png'
    const a = document.createElement('a')
    a.href = src
    a.download = `generated-${type}-${Date.now()}-${index + 1}.${ext}`
    a.click()
  }

  // グリッドレイアウト: 1枚=フル、2枚=横並び、3-4枚=2x2グリッド
  const gridClass = items.length === 1
    ? 'grid grid-cols-1 max-w-md'
    : items.length === 2
      ? 'grid grid-cols-2 max-w-lg'
      : 'grid grid-cols-2 max-w-lg'

  return (
    <>
      <div className={`${gridClass} gap-2 mt-2`}>
        {items.map((src, i) => (
          <div
            key={i}
            className="relative rounded-xl overflow-hidden cursor-pointer group transition-transform hover:scale-[1.02] hover:shadow-lg"
            onClick={() => openLightbox(i)}
          >
            {type === 'image' ? (
              <img
                src={src}
                alt={`生成画像${i + 1}`}
                className="w-full h-auto object-cover rounded-xl"
                loading="lazy"
              />
            ) : (
              <video className="w-full h-auto rounded-xl" controls>
                <source src={src} />
              </video>
            )}
            {/* ホバーオーバーレイ */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl pointer-events-none" />
          </div>
        ))}
      </div>

      {/* ライトボックスモーダル */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          {/* 閉じるボタン */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
          >
            <X className="h-6 w-6" />
          </button>

          {/* 左矢印 */}
          {items.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev() }}
              className="absolute left-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* メディア表示 */}
          <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {type === 'image' ? (
              <img
                src={items[lightboxIndex]}
                alt={`生成画像${lightboxIndex + 1}`}
                className="max-w-full max-h-[80vh] rounded-lg object-contain"
              />
            ) : (
              <video controls autoPlay className="max-w-full max-h-[80vh] rounded-lg">
                <source src={items[lightboxIndex]} />
              </video>
            )}

            {/* 下部ツールバー */}
            <div className="flex items-center gap-3 mt-3">
              {items.length > 1 && (
                <span className="text-white/60 text-sm">{lightboxIndex + 1} / {items.length}</span>
              )}
              <button
                onClick={() => handleDownload(items[lightboxIndex!], lightboxIndex!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-sm"
              >
                <Download className="h-4 w-4" />
                ダウンロード
              </button>
            </div>
          </div>

          {/* 右矢印 */}
          {items.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext() }}
              className="absolute right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </>
  )
}
