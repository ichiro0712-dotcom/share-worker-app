'use client'

import {
  Brain,
  Search,
  Database,
  Sparkles,
  Wrench,
  PenLine,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Claude Code 風の "現在何をしているか" インジケーター。
 *
 * 元々は status キー (calendar / tasks 等) → 日本語ラベルの辞書だったが、
 * 現在はサーバー側がフルラベル ("DB スキーマを確認中..." 等) を送る方針なので、
 * ここではフェーズに応じたアイコンとラベルをそのまま表示する。
 *
 * 経過秒数とトークン数も表示することで、長時間応答中も "動いている証拠" が見える。
 */

type Phase = 'thinking' | 'tool' | 'streaming' | 'organizing'

const PHASE_ICON: Record<Phase, LucideIcon> = {
  thinking: Brain,
  tool: Wrench,
  streaming: PenLine,
  organizing: Sparkles,
}

// 旧キー互換 (まだ送られてくる可能性に備えて残す)
const LEGACY_LABEL: Record<string, { icon: LucideIcon; label: string }> = {
  calendar: { icon: Search, label: 'カレンダーを確認しています' },
  tasks: { icon: Database, label: 'タスク情報を取得しています' },
  knowledge: { icon: Brain, label: '知識ソースを読み込んでいます' },
  generating: { icon: Sparkles, label: '回答を生成しています' },
}

export interface StatusIndicatorProps {
  /** 表示するメインラベル ("DB スキーマを確認中..." 等) */
  status: string
  /** ある場合は phase に応じてアイコンを切り替え */
  phase?: Phase
  /** 経過時間 (ms) — 表示すると "経過 12s" になる */
  elapsedMs?: number
  /** 出力トークン累計 — 表示すると "250 tokens" になる */
  outputTokens?: number
  /** 中止ボタンを表示するか (押下時のハンドラ) */
  onAbort?: () => void
}

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m${s.toString().padStart(2, '0')}s`
}

export function StatusIndicator({
  status,
  phase,
  elapsedMs,
  outputTokens,
  onAbort,
}: StatusIndicatorProps) {
  // legacy キーが渡された場合の後方互換
  const legacy = LEGACY_LABEL[status]
  const label = legacy ? `${legacy.label}...` : status
  const Icon = legacy ? legacy.icon : phase ? PHASE_ICON[phase] : Sparkles

  return (
    <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
      <Icon className="h-3.5 w-3.5 animate-pulse" />
      <span className="animate-pulse">{label}</span>
      {(elapsedMs !== undefined || outputTokens !== undefined) && (
        <span className="ml-1 text-slate-400">
          {elapsedMs !== undefined && <span>· 経過 {formatElapsed(elapsedMs)}</span>}
          {outputTokens !== undefined && outputTokens > 0 && (
            <span> · {outputTokens.toLocaleString()} tokens</span>
          )}
        </span>
      )}
      {onAbort && (
        <button
          onClick={onAbort}
          className="ml-2 px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="中断"
        >
          停止
        </button>
      )}
    </div>
  )
}
