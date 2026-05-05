'use client'

import { useState } from 'react'
import { cn } from '@/src/lib/cn'
import { Bot, User, Copy, Check, Loader2, Database } from 'lucide-react'
import { Button } from '@/src/components/ui/shadcn/button'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'agent'
  agent_id?: string
  content: string
  created_at: string
  pendingActions?: PendingActionInfo[]
}

export interface PendingActionInfo {
  id: string
  action_type: string
  payload: Record<string, unknown>
  status: string
}

// Advisor は単一エージェントなので、すべて "システムアドバイザー" 表示
const AGENT_LABELS: Record<string, string> = {
  orchestrator: 'システムアドバイザー',
  advisor: 'システムアドバイザー',
  action: 'システムアドバイザー',
}

const ACTION_LABELS: Record<string, string> = {
  wbs_update: 'タスク更新',
  task_create: 'タスク作成',
  calendar_create: 'カレンダー登録',
  calendar_update: 'カレンダー変更',
  calendar_delete: 'カレンダー削除',
  email_send: 'メール送信',
  email_draft: 'メール下書き',
  rule_add: 'ルール追加',
}

export function ChatMessage({
  message,
  isStreaming,
  onApproveAction,
}: {
  message: Message
  isStreaming?: boolean
  onApproveAction?: (actionId: string) => Promise<void>
}) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [executingAction, setExecutingAction] = useState<string | null>(null)
  const [executedActions, setExecutedActions] = useState<Set<string>>(new Set())

  function handleCopy() {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleApprove(actionId: string) {
    if (!onApproveAction) return
    setExecutingAction(actionId)
    await onApproveAction(actionId)
    setExecutedActions(prev => new Set(prev).add(actionId))
    setExecutingAction(null)
  }

  if (isUser) {
    return (
      <div className="flex gap-3 flex-row-reverse">
        <div className="h-7 w-7 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0">
          <User className="h-4 w-4" />
        </div>
        <div className="max-w-[80%] text-right">
          <div className="rounded-2xl rounded-br-md bg-slate-800 text-white px-4 py-2.5 text-sm leading-relaxed inline-block text-left">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </div>
    )
  }

  const actions = message.pendingActions ?? []

  return (
    <div className="group flex gap-3">
      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {message.agent_id && (
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {AGENT_LABELS[message.agent_id] ?? message.agent_id}
          </span>
        )}
        <div className="text-sm leading-relaxed prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h2]:font-semibold [&_h3]:font-medium [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {/* アクション承認ボタン */}
        {actions.length > 0 && (
          <div className="space-y-2 mt-3">
            {actions.map(action => {
              const isExecuted = executedActions.has(action.id)
              const isExecuting = executingAction === action.id
              return (
                <div key={action.id}>
                  {isExecuted ? (
                    <div className="inline-flex items-center gap-1.5 text-xs text-green-600">
                      <Check className="h-3.5 w-3.5" />
                      Project Hubに書き込みました
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApprove(action.id)}
                      disabled={isExecuting}
                      className="gap-1.5 text-xs border-slate-300 hover:bg-slate-50"
                    >
                      {isExecuting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Database className="h-3.5 w-3.5" />
                      )}
                      {ACTION_LABELS[action.action_type] ?? action.action_type}をProject Hubに書き込む
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!isStreaming && actions.length === 0 && (
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
  )
}
