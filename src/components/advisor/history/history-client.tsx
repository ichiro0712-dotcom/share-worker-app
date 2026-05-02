'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Trash2, ArrowLeft, Search, Bot } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/src/components/ui/shadcn/button'
import { Input } from '@/src/components/ui/shadcn/input'
import {
  getConversations,
  deleteConversation,
  type ConversationSummary,
} from '@/src/lib/advisor/actions/conversations'

export function HistoryClient() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const convs = await getConversations(200)
    setConversations(convs)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = searchQuery
    ? conversations.filter((c) =>
        (c.title ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations

  function getDateLabel(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return '今日'
    if (days === 1) return '昨日'
    if (days < 7) return `${days}日前`
    if (days < 30) return `${Math.floor(days / 7)}週間前`
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })
  }

  const grouped = new Map<string, ConversationSummary[]>()
  for (const item of filtered) {
    const label = getDateLabel(item.updated_at)
    if (!grouped.has(label)) grouped.set(label, [])
    grouped.get(label)!.push(item)
  }

  async function handleDelete(id: string) {
    if (!confirm('この会話を削除しますか？（アーカイブされ、一覧から非表示になります）')) return
    await deleteConversation(id)
    await load()
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/system-admin/advisor">
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-700">
              <ArrowLeft className="h-4 w-4" />
              アドバイザーに戻る
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-slate-800 text-white flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-semibold text-slate-800">チャット履歴</h1>
          </div>
          <span className="text-xs text-slate-400">{filtered.length}件</span>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="履歴を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-slate-400">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">
            {searchQuery ? '検索結果がありません' : '履歴がありません'}
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([label, items]) => (
              <div key={label}>
                <h2 className="text-xs font-medium text-slate-500 mb-2 px-1">{label}</h2>
                <div className="space-y-1">
                  {items.map((conv) => (
                    <div
                      key={conv.id}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Link
                        href={`/system-admin/advisor?c=${conv.id}`}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        <MessageSquare className="h-4 w-4 text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate text-slate-800">
                            {conv.title ?? '新しい会話'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatTime(conv.updated_at)}
                          </p>
                        </div>
                      </Link>
                      <button
                        onClick={() => handleDelete(conv.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="削除（アーカイブ）"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
