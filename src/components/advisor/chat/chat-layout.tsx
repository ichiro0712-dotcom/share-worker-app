'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Plus, MessageSquare, PanelRightClose, PanelLeftClose, PanelLeftOpen, Trash2, Sun, Settings as SettingsIcon, LogOut, Bot, ShieldCheck, RefreshCw, FileText, Bookmark, BookmarkCheck, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/src/components/ui/shadcn/button'
import { ScrollArea } from '@/src/components/ui/shadcn/scroll-area'
import { cn } from '@/src/lib/cn'
import { UnifiedMessage, cleanMessageTags, parseChoices, type ChoiceGroup } from '@/src/components/advisor/chat/unified-message'
import { ChatInput, type AttachedFile } from '@/src/components/advisor/chat/chat-input'
import { StatusIndicator } from '@/src/components/advisor/chat/status-indicator'
import { getConversations, getConversationMessages, deleteConversation, toggleBookmark, type ConversationSummary } from '@/src/lib/advisor/actions/conversations'
import { getPinnedAgents, getCAConversations, deleteCAConversation, type CustomAgent, type CAConversationSummary } from '@/src/lib/advisor/actions/custom-agents'
import { getAgentIcon, ICON_COLORS } from '@/src/lib/advisor/agent-icons'
import { approveAction } from '@/src/lib/advisor/actions/pending-actions'
import { DEFAULT_MODEL_ID, AVAILABLE_MODELS } from '@/src/lib/advisor/models'
import { ReportCanvas } from '@/src/components/advisor/report/report-canvas'
import { getDraftForSession } from '@/src/lib/advisor/actions/report-drafts'
import { stripToolHintPrefix } from '@/src/lib/advisor/message-display'
import {
  SqlApprovalModal,
  type SqlApprovalRequest,
} from '@/src/components/advisor/chat/sql-approval-modal'
import type { SqlResultTableData } from '@/src/components/advisor/chat/sql-result-table'
import { getSessionTables } from '@/src/lib/advisor/actions/chat-tables'

// Advisor は単一エージェントなので、すべて "システムアドバイザー" 表示にする
const AGENT_LABEL = 'システムアドバイザー'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'agent'
  agent_id?: string
  content: string
  created_at: string
  actionIds?: string[]
  choices?: ChoiceGroup[]
  images?: string[]    // data URI形式の画像
  videos?: string[]    // data URI形式の動画
  /** この回答を作る際に Advisor が呼んだツール名 (重複可、UI 側で集計表示) */
  sources?: string[]
}

export interface ChatLayoutProps {
  adminName: string;
  adminEmail?: string;
  adminRole?: string;
}

export function ChatLayout({ adminName, adminEmail = '', adminRole = '' }: ChatLayoutProps) {
  const searchParams = useSearchParams()
  const cidFromUrl = searchParams?.get('c') ?? null
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  // Advisor では Canvas 機能は使わない
  const [focusProject, setFocusProject] = useState<string | null>(null)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])

  // localStorageからプロジェクト選択を復元（Hydration後）
  useEffect(() => {
    const saved = localStorage.getItem('agent-hub-selected-projects')
    if (saved) try { setSelectedProjectIds(JSON.parse(saved)) } catch { /* ignore */ }
    const savedWidth = localStorage.getItem('advisor-canvas-width')
    if (savedWidth) {
      const n = Number(savedWidth)
      if (Number.isFinite(n) && n >= 360 && n <= 1600) setCanvasWidth(n)
    }
  }, [])

  const [mode, setMode] = useState<'chat' | 'briefing'>('chat')
  // Advisor では TASTAS の System Admin を直接 props 経由で受け取る
  const sessionUser = adminName
    ? { email: adminEmail, name: adminName, avatar: '' }
    : null
  const [actionStatuses, setActionStatuses] = useState<Record<string, { status: 'pending' | 'executing' | 'done' | 'failed'; result?: Record<string, string> }>>({})
  const [submittedChoices, setSubmittedChoices] = useState<Record<string, string[]>>({})
  const [twoFaRetry, setTwoFaRetry] = useState<{ actionId: string; siteName: string } | null>(null)
  const [currentStatus, setCurrentStatus] = useState<string | null>(null)
  /**
   * 進行中の活動メトリクス (Claude Code 風 "経過 12s · 250 tokens" 表示用)。
   * heartbeat イベントで更新され、応答中ずっと画面下に表示される。
   */
  const [progress, setProgress] = useState<{
    label: string
    elapsedMs: number
    outputTokens: number
    phase: 'thinking' | 'tool' | 'streaming' | 'organizing'
  } | null>(null)
  const [pinnedAgents, setPinnedAgents] = useState<CustomAgent[]>([])
  const [caConversations, setCAConversations] = useState<CAConversationSummary[]>([])
  /**
   * 右側のレポート Canvas の開閉状態。
   * - LLM が `update_report_draft` を呼んでドラフトが作られた瞬間に自動で開く
   * - ユーザーは右上のトグルボタンで明示的に閉じる/開くこともできる
   */
  const [canvasOpen, setCanvasOpen] = useState(false)
  /** ドラフトが存在するか (トグルボタンの可視判定 + 自動オープン用) */
  const [hasDraft, setHasDraft] = useState(false)
  /** 左サイドバー (チャット履歴) の表示状態 */
  const [sidebarOpen, setSidebarOpen] = useState(true)
  /** Canvas が開いた瞬間に自動折り畳みするための、直前 canvasOpen 値 */
  const prevCanvasOpenRef = useRef(false)
  /** 初回 suggestion チップから ChatInput にツール+テキストをプリフィルするためのトリガー */
  const [chatPrefill, setChatPrefill] = useState<{ toolId: string | null; text: string; nonce: number } | null>(null)
  /**
   * Canvas が現在表示しているタブ ('draft' | 'result') と「結果が存在するか」。
   * Canvas からの onViewChange callback で更新され、ChatInput の forcedTool 切替に使う。
   * - view='draft'  → forcedTool='draft_revise'
   * - view='result' && hasResult → forcedTool='result_edit'
   */
  const [canvasView, setCanvasView] = useState<{ view: 'draft' | 'result'; hasResult: boolean }>({
    view: 'draft',
    hasResult: false,
  })
  /**
   * Canvas 幅 (px)。チャット欄より大きい初期値 + 境界ドラッグでリサイズ可能。
   * localStorage に保存して再訪時に復元する。
   */
  const [canvasWidth, setCanvasWidth] = useState(960)
  const [resizingCanvas, setResizingCanvas] = useState(false)
  /**
   * Canvas に「いま何が動いているか」を伝えるためのフェーズ。
   * - 'drafting': レポート作成ツールで送信した直後 (Claude が初回ドラフトを書いている)
   * - 'updating': 既存ドラフトに対する追加修正
   * - 'idle': 何も走っていない
   */
  const [reportChatPhase, setReportChatPhase] = useState<'idle' | 'drafting' | 'updating'>('idle')
  /**
   * チャット送信のたびに +1 されるカウンター。
   * ReportCanvas 側でこれが変化したら、Canvas のローカル未保存編集 (draftEdit) を破棄して
   * Claude による DB 更新がそのまま画面に反映されるようにする。
   * 「書き換えが始まったらユーザーの未保存編集は無視」という決まり。
   */
  const [discardCanvasEditTrigger, setDiscardCanvasEditTrigger] = useState(0)

  /**
   * execute_sql が返した表データの、メッセージ ID → 表配列 のマップ。
   * ストリーミング中は仮 ID (-1) に蓄積し、done で確定 ID にリマップする。
   */
  const [sqlTablesByMessage, setSqlTablesByMessage] = useState<
    Record<string, SqlResultTableData[]>
  >({})
  /** ストリーミング中の execute_sql 結果をいったん受ける一時バッファ */
  const streamingTablesRef = useRef<SqlResultTableData[]>([])
  /**
   * SQL 承認モーダルの保留中要求 (null = 閉じている)。
   * sql_approval_required イベントを受信すると open になる。
   */
  const [pendingSqlApproval, setPendingSqlApproval] =
    useState<SqlApprovalRequest | null>(null)
  /**
   * セッション内 SQL 自動承認フラグ。
   * ユーザーがモーダルで「セッション中はスキップ」をチェックすると true。
   * 会話切替/ページリロードで false に戻る (sessionState のため永続化しない)。
   */
  const [sqlAutoApprove, setSqlAutoApprove] = useState(false)
  /**
   * モーダルで承認した「次の1リクエスト」だけ true で送るための ref。
   * setSqlAutoApprove(true) は非同期反映なので、ref で同期的に1回だけ消費する。
   */
  const sqlApproveOnceRef = useRef(false)

  /**
   * localStorage の "agent-hub-base-model" は古い無効な値 (例: "gemini-flash") が
   * 残っているケースがあるため、AVAILABLE_MODELS に存在しないものは捨てて
   * DEFAULT_MODEL_ID にフォールバックする。
   */
  const resolveBaseModelId = (): string => {
    if (typeof window === 'undefined') return DEFAULT_MODEL_ID
    const saved = localStorage.getItem('agent-hub-base-model')
    if (saved && AVAILABLE_MODELS.some((m) => m.id === saved)) return saved
    return DEFAULT_MODEL_ID
  }

  /**
   * Canvas 境界ドラッグでリサイズ。
   * mousedown で resizingCanvas=true → mousemove で幅を更新 → mouseup で確定 + localStorage 保存。
   */
  useEffect(() => {
    if (!resizingCanvas) return
    function onMove(e: MouseEvent) {
      // 右ペインの幅 = ウィンドウ幅 - マウス X 座標
      const next = Math.min(Math.max(window.innerWidth - e.clientX, 360), Math.max(window.innerWidth - 320, 480))
      setCanvasWidth(next)
    }
    function onUp() {
      setResizingCanvas(false)
      try { localStorage.setItem('advisor-canvas-width', String(Math.round(canvasWidth))) } catch { /* ignore */ }
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizingCanvas, canvasWidth])

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const loadConversations = useCallback(async () => {
    const list = await getConversations()
    setConversations(list)
  }, [])

  const loadPinnedAgents = useCallback(async () => {
    const list = await getPinnedAgents()
    setPinnedAgents(list)
  }, [])

  const loadCAConversations = useCallback(async () => {
    const list = await getCAConversations()
    setCAConversations(list)
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => { loadPinnedAgents() }, [loadPinnedAgents])
  useEffect(() => { loadCAConversations() }, [loadCAConversations])

  /**
   * 会話切替時にドラフトの存在をチェック。
   * 存在すれば Canvas を自動オープン。新規 chat 時は閉じる。
   */
  useEffect(() => {
    let cancelled = false
    if (!conversationId) {
      setHasDraft(false)
      setCanvasOpen(false)
      return
    }
    void getDraftForSession(conversationId).then(d => {
      if (cancelled) return
      const exists = !!d
      setHasDraft(exists)
      if (exists) setCanvasOpen(true)
    })
    return () => { cancelled = true }
  }, [conversationId])

  // Canvas が「閉じている → 開いた」遷移時にサイドバーを自動折り畳み。
  // Canvas を閉じてもサイドバーは自動復活させない (ユーザーの選択を尊重)。
  useEffect(() => {
    if (!prevCanvasOpenRef.current && canvasOpen) {
      setSidebarOpen(false)
    }
    prevCanvasOpenRef.current = canvasOpen
  }, [canvasOpen])

  // URL の ?c=<id> から初期会話を開く (履歴ページからの遷移用)
  // useSearchParams で URL 変化を監視するので SPA 遷移でも動く。
  // 注意: URL から ?c= を消す処理 (router.replace) は意図的にやらない。
  // force-dynamic + replace の組み合わせで RSC payload 再取得 → ChatLayout 再マウント
  // → state がリセットされる挙動があったため、URL に ?c= を残したまま運用する。
  // (リロード時に同じセッションが復元されるメリットもある)
  useEffect(() => {
    if (!cidFromUrl) return
    if (cidFromUrl === conversationId) return  // 既に同じ会話を開いていれば何もしない
    let cancelled = false
    ;(async () => {
      setConversationId(cidFromUrl)
      setMessages([])
      setSqlTablesByMessage({})
      const msgs = await getConversationMessages(cidFromUrl)
      if (cancelled) return
      setMessages(msgs.map(m => ({
        id: m.id,
        role: m.role as Message['role'],
        agent_id: m.agent_id ?? undefined,
        content: m.role === 'user' ? stripToolHintPrefix(m.content) : m.content,
        created_at: m.created_at,
      })))
      const tableMap = await fetchAndMapSessionTables(cidFromUrl, msgs)
      if (cancelled) return
      setSqlTablesByMessage(tableMap)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidFromUrl])

  // sessionUser は props から計算済みなので useEffect 不要

  useEffect(() => {
    const saved = localStorage.getItem('agent-hub-dark')
    if (saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingContent])

  /**
   * 応答中は 1 秒ごとにクライアント側で経過時間を進める。
   * サーバー側 heartbeat は 5 秒間隔だが、表示上は毎秒カウンタが動くようにする (Claude Code 風)。
   * heartbeat が届いた瞬間にサーバー側の正確な値で上書きされる。
   */
  useEffect(() => {
    if (!loading) return
    const t = setInterval(() => {
      setProgress(prev => prev ? { ...prev, elapsedMs: prev.elapsedMs + 1000 } : prev)
    }, 1000)
    return () => clearInterval(t)
  }, [loading])

  // cleanTags is now imported as cleanMessageTags from unified-message

  async function handleSelectConversation(id: string) {
    if (id === conversationId) return
    setConversationId(id)
    setMessages([])
    setSqlTablesByMessage({})
    // 注意: ここで setLoading(true) を立てない。
    // loading は「LLM 応答中」フラグとして UI が「考え中...」を表示するために使われており、
    // 過去メッセージの fetch にこれを使うと、履歴ページから遷移したときに永続的に
    // 考え中表示になってしまう (元のセッションに応答中の処理が無いため fetch 完了後も
    // 解除されないバグの原因になる)。
    const msgs = await getConversationMessages(id)
    setMessages(msgs.map(m => ({
      id: m.id,
      role: m.role as Message['role'],
      agent_id: m.agent_id ?? undefined,
      // 過去データに [TOOL:xxx] が残っているケースの救済 (現在は orchestrator で剥がしてから保存)
      content: m.role === 'user' ? stripToolHintPrefix(m.content) : m.content,
      created_at: m.created_at,
    })))
    const tableMap = await fetchAndMapSessionTables(id, msgs)
    setSqlTablesByMessage(tableMap)
  }

  /**
   * 指定セッションの SQL 結果表 (advisor_chat_tables) を取得し、
   * 時系列で「自分より前の最も新しい assistant メッセージ」に紐付けてマップを返す。
   *
   * 紐付け規約 (C 案):
   * - 表.created_at より前の assistant メッセージのうち最も新しいものに紐付ける
   * - 該当 assistant が無ければ最初の assistant メッセージにフォールバック (= 古い会話で
   *   message_id が記録されていないケースの救済)
   * - assistant メッセージが1つも無い場合は捨てる (実運用ではほぼ起きない)
   */
  async function fetchAndMapSessionTables(
    sessionId: string,
    msgs: Array<{ id: string; role: string; created_at: string }>
  ): Promise<Record<string, SqlResultTableData[]>> {
    let tables: Awaited<ReturnType<typeof getSessionTables>>
    try {
      tables = await getSessionTables(sessionId)
    } catch (e) {
      console.warn('[advisor] getSessionTables failed:', e)
      return {}
    }
    if (tables.length === 0) return {}

    const assistantMsgs = msgs
      .filter(m => m.role === 'assistant' || m.role === 'agent')
      .map(m => ({ id: m.id, t: new Date(m.created_at).getTime() }))
      .sort((a, b) => a.t - b.t)
    if (assistantMsgs.length === 0) return {}

    const out: Record<string, SqlResultTableData[]> = {}
    for (const tbl of tables) {
      const tableTime = new Date(tbl.createdAt).getTime()
      // 自分より前の assistant メッセージで最も新しいもの
      let target = assistantMsgs[0].id
      for (const am of assistantMsgs) {
        if (am.t <= tableTime) target = am.id
        else break
      }
      const data: SqlResultTableData = {
        tableId: tbl.tableId,
        tableDbId: tbl.tableDbId,
        purpose: tbl.purpose,
        sqlText: tbl.sqlText,
        columns: tbl.columns,
        rows: tbl.rows,
        rowCount: tbl.rowCount,
        truncated: tbl.truncated,
        durationMs: tbl.durationMs ?? undefined,
      }
      ;(out[target] ??= []).push(data)
    }
    return out
  }

  /**
   * 現在の会話のメッセージを DB から再取得して messages state を上書き。
   * Canvas 側でレポート生成 / 再生成が走った時に、サーバー側で appendMessage された
   * 「📊 レポート vN を生成しました」イベントメッセージを画面に取り込む。
   */
  async function reloadCurrentMessages() {
    if (!conversationId) return
    const msgs = await getConversationMessages(conversationId)
    setMessages(msgs.map(m => ({
      id: m.id,
      role: m.role as Message['role'],
      agent_id: m.agent_id ?? undefined,
      content: m.role === 'user' ? stripToolHintPrefix(m.content) : m.content,
      created_at: m.created_at,
    })))
    const tableMap = await fetchAndMapSessionTables(conversationId, msgs)
    setSqlTablesByMessage(tableMap)
  }

  async function handleDeleteConversation(id: string) {
    await deleteConversation(id)
    if (conversationId === id) {
      setConversationId(null)
      setMessages([])
    }
    await loadConversations()
  }

  /** ストリーミングリクエストを送信し、レスポンスを処理する共通関数 */
  async function streamRequest(
    endpoint: string,
    text: string,
    convId: string | null,
    reqModelId?: string,
    files?: { name: string; mimeType: string; base64: string }[],
    sqlAutoApproveOverride?: boolean
  ): Promise<{ accumulated: string; data: Record<string, any> | null; sources: string[] }> {
    const controller = new AbortController()
    abortRef.current = controller

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        conversationId: convId,
        projectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
        modelId: reqModelId,
        files: files && files.length > 0 ? files : undefined,
        sqlAutoApprove: (() => {
          if (sqlAutoApproveOverride !== undefined) return sqlAutoApproveOverride
          if (sqlApproveOnceRef.current) {
            sqlApproveOnceRef.current = false
            return true
          }
          return sqlAutoApprove
        })(),
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      let serverErr = ''
      try { serverErr = await res.text() } catch { /* noop */ }
      throw new Error(`API error ${res.status} ${serverErr}`)
    }
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No stream')

    const decoder = new TextDecoder()
    let accumulated = ''
    let buffer = ''
    let finalData: Record<string, any> | null = null
    const sources: string[] = []

    /** 行を1つ処理。 done イベントなら true を返す */
    const handleLine = (line: string): boolean => {
      if (!line.startsWith('data: ')) return false
      const payload = line.slice(6).trim()
      if (!payload) return false
      let data: Record<string, any>
      try {
        data = JSON.parse(payload)
      } catch (e) {
        // 解析失敗は1行スキップ (壊れた JSON を握りつぶす)
        console.warn('[advisor] failed to parse SSE line:', payload, e)
        return false
      }
      if (data.type === 'status') {
        setCurrentStatus(typeof data.status === 'string' ? data.status : null)
      } else if (data.type === 'tool_use') {
        // Advisor が参照したデータソースを蓄積 (回答下部の「参照したデータソース」表示用)
        if (typeof data.name === 'string') sources.push(data.name)
      } else if (data.type === 'heartbeat') {
        // サーバー側 5秒ごとの "動いてる証拠" イベント。経過秒数 + トークン数 + ラベルを更新。
        if (process.env.NODE_ENV === 'development') {
          console.debug('[advisor] heartbeat:', data.label, `${Math.floor((data.elapsedMs ?? 0) / 1000)}s`)
        }
        setProgress({
          label: typeof data.label === 'string' ? data.label : '処理中...',
          elapsedMs: typeof data.elapsedMs === 'number' ? data.elapsedMs : 0,
          outputTokens: typeof data.outputTokens === 'number' ? data.outputTokens : 0,
          phase: data.phase ?? 'thinking',
        })
      } else if (data.type === 'text') {
        // text が来てもステータスは消さない (Claude Code 風: 常時メトリクス表示)
        accumulated += String(data.text ?? '')
        setStreamingContent(accumulated)
      } else if (data.type === 'done') {
        setCurrentStatus(null)
        setProgress(null)
        finalData = data
        return true
      } else if (data.type === 'error') {
        setProgress(null)
        throw new Error(typeof data.text === 'string' ? data.text : 'Unknown stream error')
      } else if (data.type === 'sql_approval_required') {
        // 承認モーダル発火
        setPendingSqlApproval({
          toolUseId: String(data.toolUseId ?? ''),
          purpose: String(data.purpose ?? '(目的未指定)'),
          sql: String(data.sql ?? ''),
          expectedRows:
            typeof data.expectedRows === 'number' ? data.expectedRows : undefined,
        })
      } else if (data.type === 'tool_result' && data.ok && data.data) {
        // execute_sql の成功結果 (table_id を含む) を一時バッファに積む。
        // done で「直前 assistant メッセージ」に紐づける。
        const d = data.data as Record<string, unknown>
        if (
          typeof d.table_id === 'string' &&
          typeof d.table_db_id === 'number' &&
          Array.isArray(d.columns) &&
          Array.isArray(d.rows)
        ) {
          streamingTablesRef.current.push({
            tableId: d.table_id,
            tableDbId: d.table_db_id,
            purpose: String(d.purpose ?? ''),
            sqlText: typeof d.sql_text === 'string' ? d.sql_text : undefined,
            columns: d.columns as SqlResultTableData['columns'],
            rows: d.rows as unknown[][],
            rowCount: typeof d.row_count === 'number' ? d.row_count : (d.rows as unknown[]).length,
            truncated: Boolean(d.truncated),
            durationMs: typeof d.duration_ms === 'number' ? d.duration_ms : undefined,
          })
        }
      }
      // tool_use / usage は UI で消費する余地があるが今は無視
      return false
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      // 完全な行を取り出してから処理 (分割された JSON が完成するのを待つ)
      let nlIdx: number
      while ((nlIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nlIdx)
        buffer = buffer.slice(nlIdx + 1)
        const isDone = handleLine(line)
        if (isDone) {
          return { accumulated, data: finalData, sources }
        }
      }
    }
    // 残バッファに data: が残っているケース
    if (buffer.trim()) {
      try { handleLine(buffer.trim()) } catch (e) { console.warn(e) }
    }
    return { accumulated, data: finalData, sources }
  }

  async function handleChatSubmit(text: string, submitModelId: string, attachedFiles: AttachedFile[], toolId?: string) {
    if ((!text && attachedFiles.length === 0) || loading) return

    // suggestion チップ (prefill) で起動したターンを送信した瞬間に prefill state をクリアする。
    // クリアしないと、ChatInput が conversationId 切替で再マウントされた直後に
    // 同じ prefill が「新しいリクエスト」として再適用され、入力欄にテンプレが復活してしまう。
    setChatPrefill(null)

    // レポート作成ツールが指定されたら、送信タイミングで Canvas を開く
    // (ドラフトはまだ無い → プレビュー (0 埋め表) が表示される)
    if (toolId === 'report_create') {
      setHasDraft(true)
      setCanvasOpen(true)
      setReportChatPhase('drafting')
    } else if (canvasOpen && hasDraft) {
      // すでに Canvas が開いている = ドラフトに対する追加修正 (Claude が update_report_draft を呼ぶ可能性)
      setReportChatPhase('updating')
    }

    // Canvas のローカル未保存編集をこの瞬間に破棄するシグナル。
    // チャット指示で DB が書き換わるのが優先される。
    if (canvasOpen && hasDraft) {
      setDiscardCanvasEditTrigger((n) => n + 1)
    }

    // 添付ファイルをbase64に変換
    const fileDataList: { name: string; mimeType: string; base64: string }[] = []
    for (const af of attachedFiles) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          // "data:image/png;base64,..." から base64部分だけ取得
          resolve(dataUrl.split(',')[1] ?? '')
        }
        reader.readAsDataURL(af.file)
      })
      fileDataList.push({ name: af.file.name, mimeType: af.file.type || 'application/octet-stream', base64 })
    }

    const displayText = text + (fileDataList.length > 0 ? `\n\n*${fileDataList.map(f => f.name).join(', ')} を添付*` : '')
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: displayText, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    setStreamingContent('')
    // heartbeat の初回を待たずに即座に "考え中..." を表示開始
    setProgress({ label: '考え中...', elapsedMs: 0, outputTokens: 0, phase: 'thinking' })

    try {
      // 画像添付 + 画像生成ツール → LLMを経由せずAPI直接呼び出し
      if (toolId === 'generate_image' && fileDataList.length > 0 && fileDataList.some(f => f.mimeType.startsWith('image/'))) {
        const imageFile = fileDataList.find(f => f.mimeType.startsWith('image/'))!
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: 'assistant', agent_id: 'action',
          content: '画像を編集中...',
          created_at: new Date().toISOString(),
        }])
        setStreamingContent('')

        try {
          const res = await fetch('/api/media/edit-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: text || 'Edit this image as requested',
              imageBase64: imageFile.base64,
              imageMimeType: imageFile.mimeType,
            }),
          })
          const editResult = await res.json() as { ok: boolean; images?: string[]; error?: string }
          if (editResult.ok && editResult.images && editResult.images.length > 0) {
            playNotificationSound('success')
            setMessages(prev => [...prev, {
              id: crypto.randomUUID(), role: 'assistant', agent_id: 'action',
              content: `画像を編集しました。（${editResult.images!.length}枚）`,
              images: editResult.images,
              created_at: new Date().toISOString(),
            }])
          } else {
            setMessages(prev => [...prev, {
              id: crypto.randomUUID(), role: 'assistant', agent_id: 'action',
              content: editResult.error ?? '画像編集に失敗しました',
              created_at: new Date().toISOString(),
            }])
          }
        } catch (e) {
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(), role: 'assistant', agent_id: 'action',
            content: '画像編集でエラーが発生しました',
            created_at: new Date().toISOString(),
          }])
        }
        setLoading(false)
        return
      }

      // Advisor では briefing モードも通常チャット (Advisor は単一エージェントのため)
      const endpoint = '/api/advisor/chat'
      // ツール選択時はメッセージにツール指示を付加
      const messageWithTool = toolId
        ? `[TOOL:${toolId}] ${text}`
        : text
      const result = await streamRequest(endpoint, messageWithTool, conversationId, submitModelId, fileDataList.length > 0 ? fileDataList : undefined)

      const agentId = 'advisor'
      const { cleanContent: choicesParsed, choices } = parseChoices(result.accumulated)
      const cleanContent = cleanMessageTags(choicesParsed)

      // アクション情報
      const actionIds: string[] = result.data?.actions ?? []

      // 同意パターン検知: 直前のユーザーメッセージが同意なら自動承認
      const consentPatterns = /^(はい|うん|お願い|OK|ok|いいよ|いいです|やって|実行して|生成して|作って|それで|頼む|お願いします|よろしく|進めて)$/i
      const isConsent = consentPatterns.test(text.trim())

      if (actionIds.length > 0 && isConsent) {
        // 自動承認: アクションを即実行
        for (const id of actionIds) {
          setActionStatuses(prev => ({ ...prev, [id]: { status: 'executing' } }))
        }
        // 非同期で全アクション実行（メッセージ表示後に結果を追加）
        setTimeout(async () => {
          for (const actionId of actionIds) {
            const actionResult = await approveAction(actionId)
            setActionStatuses(prev => ({ ...prev, [actionId]: { status: actionResult.success ? 'done' : 'failed', result: actionResult.result } }))
            if (actionResult.success) {
              let autoContent = '実行が完了しました。'
              let autoImages: string[] | undefined
              let autoVideos: string[] | undefined
              if (actionResult.actionType === 'generate_image' && actionResult.result?.images) {
                autoImages = actionResult.result.images.split('|||')
                autoContent = `画像を${actionResult.result.count ?? '1'}枚生成しました。`
              } else if (actionResult.actionType === 'generate_video' && actionResult.result?.video) {
                autoVideos = [actionResult.result.video]
                autoContent = '動画を生成しました。'
              } else if (actionResult.actionType === 'cdp_fetch' && actionResult.result?.content) {
                const siteName = actionResult.result.site ?? 'サイト'
                const pageTitle = actionResult.result.title ? `（${actionResult.result.title}）` : ''
                autoContent = `**${siteName}${pageTitle}** から取得:\n\n${actionResult.result.content}`
              } else if (actionResult.result?.meetUrl) {
                autoContent = `カレンダーに登録しました。\n\n**Google Meet URL:** [${actionResult.result.meetUrl}](${actionResult.result.meetUrl})`
                if (actionResult.result?.eventUrl) autoContent += `\n**カレンダー:** [予定を開く](${actionResult.result.eventUrl})`
              } else if (actionResult.result?.message) {
                autoContent = actionResult.result.message
              } else if (actionResult.result?.content) {
                autoContent = actionResult.result.content
              }
              playNotificationSound('success')
              setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', agent_id: 'action', content: autoContent, images: autoImages, videos: autoVideos, created_at: new Date().toISOString() }])
            } else if (actionResult.error) {
              setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', agent_id: 'action', content: actionResult.error ?? 'エラーが発生しました', created_at: new Date().toISOString() }])
            }
          }
        }, 0)
      } else {
        for (const id of actionIds) {
          setActionStatuses(prev => ({ ...prev, [id]: { status: 'pending' } }))
        }
      }

      // アクション承認待ちまたは選択肢がある場合は通知音（自動承認時は鳴らさない）
      if ((actionIds.length > 0 && !isConsent) || choices.length > 0) {
        playNotificationSound('action')
      }

      const newMessageId = result.data?.messageId ?? crypto.randomUUID()
      // サーバー側で Markdown 表に T-XXX を後付け採番した結果が返ってきたらそれを優先表示
      // (リロード無しで「表 T-XXX」プレフィックス + SqlResultTable が出るようにする)
      // 注意: orchestrator は done イベントを `{ type, messageId, conversationId, data: { annotatedContent } }`
      // の形で送るため、annotatedContent は外側の result.data ではなく内側の result.data.data に入る。
      const doneInnerData = result.data?.data as
        | { annotatedContent?: unknown }
        | undefined
      const annotatedContent =
        typeof doneInnerData?.annotatedContent === 'string'
          ? cleanMessageTags(doneInnerData.annotatedContent)
          : null
      setMessages(prev => [...prev, {
        id: newMessageId,
        role: 'assistant',
        agent_id: agentId,
        content: annotatedContent ?? cleanContent,
        created_at: new Date().toISOString(),
        actionIds: actionIds.length > 0 ? actionIds : undefined,
        choices: choices.length > 0 ? choices : undefined,
        sources: result.sources.length > 0 ? result.sources : undefined,
      }])
      setStreamingContent('')

      // execute_sql の結果表をメッセージ ID に紐づけ (即時バッファ分)
      if (streamingTablesRef.current.length > 0) {
        const tables = streamingTablesRef.current
        streamingTablesRef.current = []
        setSqlTablesByMessage(prev => ({ ...prev, [newMessageId]: tables }))
      }

      // サーバー側で Markdown 表に T-XXX が後付けされた場合、本文中の T-XXX に対応する
      // SqlResultTableData を DB から取得して紐付ける。
      // 注意: 新規セッションでも動くよう result.data?.conversationId を優先で使う
      //       (この時点で state の conversationId はまだ反映されていない)
      const sessionIdForTables =
        (result.data?.conversationId as string | undefined) ?? conversationId
      if (annotatedContent && sessionIdForTables) {
        try {
          const all = await getSessionTables(sessionIdForTables)
          // 本文に登場する T-XXX のみ抽出
          const referenced = new Set<string>()
          const re = /\*\*表 (T-\d+)\*\*/g
          let m: RegExpExecArray | null
          while ((m = re.exec(annotatedContent)) !== null) referenced.add(m[1])
          const dataForMsg: SqlResultTableData[] = all
            .filter(t => referenced.has(t.tableId))
            .map(t => ({
              tableId: t.tableId,
              tableDbId: t.tableDbId,
              purpose: t.purpose,
              columns: t.columns,
              rows: t.rows,
              rowCount: t.rowCount,
              truncated: t.truncated,
              durationMs: t.durationMs ?? undefined,
            }))
          if (dataForMsg.length > 0) {
            setSqlTablesByMessage(prev => ({
              ...prev,
              [newMessageId]: [...(prev[newMessageId] ?? []), ...dataForMsg],
            }))
          }
        } catch (e) {
          console.warn('[advisor] annotate post-fetch failed:', e)
        }
      }

      // 今回の応答で update_report_draft または add_tables_to_report が呼ばれていたら Canvas を自動オープン
      if (
        result.sources.includes('update_report_draft') ||
        result.sources.includes('add_tables_to_report')
      ) {
        setHasDraft(true)
        setCanvasOpen(true)
      }

      if (result.data?.conversationId && !conversationId) {
        setConversationId(result.data.conversationId)
        await loadConversations()
      }
      if (result.data?.focusProject) {
        setFocusProject(result.data.focusProject)
        // Advisor では Canvas を使わない (no-op)
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // ユーザーが中断した
        setStreamingContent('')
      } else {
        const errMsg = e instanceof Error ? e.message : String(e)
        console.error('[advisor] chat error:', e)
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          agent_id: 'advisor',
          content: `エラーが発生しました。もう一度お試しください。\n\n\`\`\`\n${errMsg}\n\`\`\``,
          created_at: new Date().toISOString(),
        }])
        setStreamingContent('')
      }
    } finally {
      abortRef.current = null
      setLoading(false)
      setProgress(null)
      setCurrentStatus(null)
      setReportChatPhase('idle')
    }
  }

  function handleAbort() {
    abortRef.current?.abort()
    setProgress(null)
    setCurrentStatus(null)
    // ストリーミング途中のコンテンツをメッセージとして確定
    if (streamingContent) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant', agent_id: 'advisor',
        content: cleanMessageTags(streamingContent) + '\n\n*(中断されました)*', created_at: new Date().toISOString(),
      }])
      setStreamingContent('')
    }
  }

  /** 通知音を再生 */
  function playNotificationSound(type: 'attention' | 'success' | 'action') {
    try {
      const ctx = new AudioContext()
      if (type === 'attention') {
        // 注意喚起: 2音の上昇チャイム
        const notes = [660, 880]
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = 'sine'
          osc.connect(g)
          g.connect(ctx.destination)
          osc.frequency.value = freq
          const t = ctx.currentTime + i * 0.2
          g.gain.setValueAtTime(0.25, t)
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
          osc.start(t)
          osc.stop(t + 0.3)
        })
      } else if (type === 'success') {
        // 成功: 短い上昇音
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'triangle'
        osc.connect(g)
        g.connect(ctx.destination)
        osc.frequency.setValueAtTime(523, ctx.currentTime)
        osc.frequency.linearRampToValueAtTime(784, ctx.currentTime + 0.15)
        g.gain.setValueAtTime(0.2, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        osc.start()
        osc.stop(ctx.currentTime + 0.3)
      } else if (type === 'action') {
        // アクション承認待ち: 軽いポップ音
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.connect(g)
        g.connect(ctx.destination)
        osc.frequency.value = 740
        g.gain.setValueAtTime(0.15, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
      }
    } catch { /* AudioContext unavailable */ }
  }

  /** 2FAリトライ: 認証完了後にcdp_fetchを再実行 */
  async function handleTwoFaRetry() {
    if (!twoFaRetry || !conversationId) return
    const { siteName } = twoFaRetry
    setTwoFaRetry(null)
    // 新しいcdp_fetchアクションを作成して自動承認
    const { createPendingAction } = await import('@/src/lib/advisor/actions/pending-actions')
    const newActionId = await createPendingAction(conversationId, 'cdp_fetch', { site_name: siteName })
    if (!newActionId) return
    setActionStatuses(prev => ({ ...prev, [newActionId]: { status: 'executing' } }))
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(), role: 'assistant', agent_id: 'action',
      content: `${siteName}に再接続しています...`,
      created_at: new Date().toISOString(),
    }])
    const result = await approveAction(newActionId)
    setActionStatuses(prev => ({ ...prev, [newActionId]: { status: result.success ? 'done' : 'failed', result: result.result } }))
    if (result.success && result.result?.content) {
      playNotificationSound('success')
      const pageTitle = result.result.title ? `（${result.result.title}）` : ''
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant', agent_id: 'action',
        content: `**${result.result?.site ?? siteName}${pageTitle}** から取得:\n\n${result.result?.content ?? ''}`,
        created_at: new Date().toISOString(),
      }])
    } else if (result.error) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant', agent_id: 'action',
        content: result.error ?? 'リトライに失敗しました',
        created_at: new Date().toISOString(),
      }])
    }
  }

  function handleNewChat() {
    setMessages([])
    setConversationId(null)
    setInput('')
    setStreamingContent('')
    setFocusProject(null)
    setMode('chat')
    inputRef.current?.focus()
  }

  async function handleStartBriefing() {
    setMessages([])
    setConversationId(null)
    setInput('')
    setStreamingContent('')
    setMode('briefing')
    setLoading(true)

    const greeting = 'ブリーフィングを始めてください'
    setMessages([{ id: crypto.randomUUID(), role: 'user', content: greeting, created_at: new Date().toISOString() }])

    try {
      const savedModel = localStorage.getItem('agent-hub-base-model') ?? undefined
      const result = await streamRequest('/api/advisor/chat', greeting, null, savedModel)
      setMessages(prev => [...prev, {
        id: result.data?.messageId ?? crypto.randomUUID(),
        role: 'assistant', agent_id: 'briefing',
        content: result.accumulated, created_at: new Date().toISOString(),
      }])
      setStreamingContent('')
      if (result.data?.conversationId) {
        setConversationId(result.data.conversationId)
        await loadConversations()
      }
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: 'ブリーフィングの開始に失敗しました。', created_at: new Date().toISOString(),
      }])
      setStreamingContent('')
    } finally {
      abortRef.current = null
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  // handleKeyDown is now handled by ChatInput component

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'たった今'
    if (diffMin < 60) return `${diffMin}分前`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}時間前`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}日前`
    return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex h-screen">
      {/* サイドバー折り畳み中の細い展開ボタン (md 以上のみ) */}
      {!sidebarOpen && (
        <div className="hidden md:flex w-9 border-r border-slate-200 bg-slate-50 shrink-0 flex-col items-center pt-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700 flex items-center justify-center"
            title="チャット履歴を開く"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNewChat}
            className="mt-2 h-8 w-8 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700 flex items-center justify-center"
            title="新規チャット"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 会話サイドバー (折り畳み可能) */}
      <div className={`${sidebarOpen ? 'hidden md:flex' : 'hidden'} w-64 border-r border-slate-200 bg-slate-50 flex-col shrink-0`}>
        <div className="p-3 border-b border-slate-200">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold text-slate-800 truncate">System Advisor</div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="h-7 w-7 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 flex items-center justify-center shrink-0"
              title="チャット履歴を折り畳む"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <Button
            size="sm"
            className="w-full gap-1.5 text-xs rounded-full bg-slate-800 hover:bg-slate-900 text-white"
            onClick={handleNewChat}
          >
            <Plus className="h-3.5 w-3.5" />
            新規chat
          </Button>
          <Link
            href="/system-admin/advisor/reports"
            className="mt-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors border border-slate-200"
          >
            <FileText className="h-3.5 w-3.5" />
            レポート履歴
          </Link>
        </div>

        {/* チャット履歴（通常会話 + CA会話をマージ） */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {conversations.length === 0 ? (
              <div className="px-2 py-6 text-xs text-slate-400 text-center">
                まだ会話がありません
              </div>
            ) : (
              conversations.slice(0, 30).map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer text-sm transition-colors',
                    conv.id === conversationId
                      ? 'bg-slate-200 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate flex-1 text-xs">{stripToolHintPrefix(conv.title) || '新しい会話'}</span>
                  {/* しおり: ON のときは常時表示 (永続保存中の目印)、OFF のときは hover 時のみ表示 */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      const res = await toggleBookmark(conv.id)
                      if (res.ok) {
                        setConversations((prev) =>
                          prev.map((c) => (c.id === conv.id ? { ...c, bookmarked: res.bookmarked } : c))
                        )
                      }
                    }}
                    className={cn(
                      'p-0.5 rounded shrink-0',
                      conv.bookmarked
                        ? 'text-amber-500 hover:text-amber-600'
                        : 'hidden group-hover:block text-slate-400 hover:text-amber-500'
                    )}
                    title={
                      conv.bookmarked
                        ? 'しおり ON: このセッションのレポートは永続保存されます'
                        : 'しおりを付ける (このセッションのレポートを永続保存)'
                    }
                  >
                    {conv.bookmarked ? (
                      <BookmarkCheck className="h-3 w-3 fill-amber-400" />
                    ) : (
                      <Bookmark className="h-3 w-3" />
                    )}
                  </button>
                  <span className={cn('text-[9px] text-slate-400 shrink-0', conv.bookmarked ? '' : 'group-hover:hidden')}>
                    {formatTime(conv.updated_at)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteConversation(conv.id)
                    }}
                    className="hidden group-hover:block p-0.5 rounded text-slate-400 hover:text-red-500"
                    title="削除"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* サイドバー下部: すべての履歴を見る + レポート履歴 */}
        {conversations.length > 0 && (
          <div className="border-t border-slate-200 p-2 space-y-0.5">
            <Link
              href="/system-admin/advisor/history"
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              すべての履歴を見る
            </Link>
          </div>
        )}
      </div>

      {/* Chat領域 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-md bg-slate-800 text-white flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-medium text-slate-800 shrink-0">システムアドバイザー</span>
            <span className="text-xs text-slate-400 shrink-0">/</span>
            <span className="text-xs text-slate-600 truncate">
              {conversationId
                ? stripToolHintPrefix(conversations.find(c => c.id === conversationId)?.title) || '会話'
                : '新しい会話'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* レポート Canvas トグル: ドラフトが存在する時だけ表示。
                ラベル付きで「ここからレポートを開ける」ことを明示する
                (アイコンだけだと気付かれにくく、ユーザーが「再度ひらけない」と
                 報告したのを受けて明示化した) */}
            {hasDraft && (
              <Button
                size="sm"
                variant={canvasOpen ? 'ghost' : 'outline'}
                onClick={() => setCanvasOpen(v => !v)}
                className="h-7 px-2 gap-1.5 text-xs"
                title={canvasOpen ? 'レポート Canvas を閉じる' : 'レポート Canvas を開く'}
              >
                {canvasOpen ? (
                  <>
                    <PanelRightClose className="h-3.5 w-3.5" />
                    <span>レポートを閉じる</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5" />
                    <span>レポートを開く</span>
                  </>
                )}
              </Button>
            )}
            {/* 設定ページへのリンク (歯車アイコン) — 新規タブで開く */}
            <a
              href="/system-admin/advisor/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="システムアドバイザー設定 (新規タブ)"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* メッセージ一覧 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 && !loading && !streamingContent ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Bot className="h-7 w-7 text-slate-700" />
              </div>
              <h2 className="text-lg font-semibold mb-2 text-slate-800">System Advisor</h2>
              <p className="text-sm text-slate-500 max-w-lg leading-relaxed">
                TASTAS のシステム・データ・ログ・GA4 などについて、自然言語で質問できるアドバイザーです。
                <br />
                コードや本番データを変更することはありません (読み取り専用)。
              </p>
              <div className="mt-6">
                <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                  {[
                    // mode='submit': クリック即送信 (シンプルチャット用)
                    // mode='prefill': ChatInput にツール選択 + テキストを入れて、ユーザーが内容を確認後に Enter で送信
                    { label: 'ログの集計を依頼したい', message: '直近のログを集計して、エラーやアクセス傾向の概要を教えてください。', mode: 'submit' as const },
                    { label: '追加機能を検討したい', message: '新しい機能の追加を検討しています。技術的に可能か、影響範囲を含めて教えてください。', mode: 'submit' as const },
                    { label: 'システムや仕様について聞きたい', message: 'TASTAS の仕様や実装について質問させてください。', mode: 'submit' as const },
                    {
                      label: 'ログを集計してレポート生成',
                      message:
                        'ログを集計してレポートを作成したいです。\n' +
                        '- 対象期間: (例: 直近 24 時間 / 直近 7 日)\n' +
                        '- レポートの目的: (例: エラー傾向の振り返り / デプロイ前後の安定性確認)\n' +
                        '- 含めたいログソース: (例: Vercel ログ (error/warning/info)、Supabase ログ (postgres/api/auth)、DB エラーログ、最近のデプロイ履歴)',
                      mode: 'prefill' as const,
                      toolId: 'report_create',
                    },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={() => {
                        if (item.mode === 'prefill') {
                          setChatPrefill({ toolId: item.toolId, text: item.message, nonce: Date.now() })
                        } else {
                          handleChatSubmit(item.message, DEFAULT_MODEL_ID, [], undefined)
                        }
                      }}
                      className="px-4 py-2 rounded-full border border-slate-200 text-sm text-slate-700 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50 transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-4 px-4 space-y-4">
              {messages.map(msg => (
                <UnifiedMessage
                  key={msg.id}
                  message={{
                    id: msg.id,
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                    created_at: msg.created_at,
                    agentLabel: msg.role === 'assistant' || msg.role === 'agent' ? AGENT_LABEL : undefined,
                    actionIds: msg.actionIds,
                    choices: msg.choices,
                    images: msg.images,
                    videos: msg.videos,
                    sources: msg.sources,
                  }}
                  sqlTables={sqlTablesByMessage[msg.id]}
                  onSendTableToReport={(tableId) => {
                    handleChatSubmit(
                      `表 ${tableId} をレポートに追加してください。`,
                      resolveBaseModelId(),
                      []
                    )
                  }}
                  actionStatuses={actionStatuses}
                  onApproveAction={async (actionId) => {
                    setActionStatuses(prev => ({ ...prev, [actionId]: { status: 'executing' } }))
                    const result = await approveAction(actionId)
                    setActionStatuses(prev => ({ ...prev, [actionId]: { status: result.success ? 'done' : 'failed', result: result.result } }))
                    if (result.success) {
                      let content = '実行が完了しました。'
                      if (result.result?.meetUrl) {
                        content = `カレンダーに登録しました。\n\n**Google Meet URL:** [${result.result.meetUrl}](${result.result.meetUrl})`
                      }
                      if (result.result?.eventUrl) {
                        content += `\n**カレンダー:** [予定を開く](${result.result.eventUrl})`
                      }
                      // OpenClawローカル操作の結果表示
                      if (result.actionType === 'local_file_list' && result.result?.files) {
                        const files = result.result.files.split('\n').filter((f: string) => f.trim())
                        const folders = files.filter((f: string) => f.endsWith('/'))
                        const regularFiles = files.filter((f: string) => !f.endsWith('/'))
                        const lines: string[] = []
                        if (folders.length > 0) {
                          lines.push('**フォルダ:**')
                          folders.forEach((f: string) => lines.push(`- ${f}`))
                        }
                        if (regularFiles.length > 0) {
                          if (folders.length > 0) lines.push('')
                          lines.push('**ファイル:**')
                          regularFiles.forEach((f: string) => lines.push(`- ${f}`))
                        }
                        content = lines.join('\n')
                      } else if (result.actionType === 'local_screenshot' && result.result?.content) {
                        content = result.result.content
                      } else if (result.actionType === 'local_open_app' && result.result?.content) {
                        content = result.result.content
                      } else if (result.actionType === 'local_file_write' && result.result?.content) {
                        content = result.result.content
                      } else if (result.actionType === 'local_file_read' && result.result?.content) {
                        content = result.result.content
                      } else if (result.actionType === 'local_web_fetch' && result.result?.content) {
                        content = result.result.content
                      } else if (result.actionType === 'local_command' && result.result?.content) {
                        content = result.result.content
                      } else if (result.actionType === 'generate_image' && result.result?.images) {
                        // imagesフィールドに分離（contentにbase64を入れない）
                        content = `画像を${result.result.count ?? '1'}枚生成しました。`
                      } else if (result.actionType === 'generate_video' && result.result?.video) {
                        content = '動画を生成しました。'
                      } else if (result.actionType === 'cdp_fetch' && result.result?.content) {
                        const siteName = result.result.site ?? 'サイト'
                        const pageTitle = result.result.title ? `（${result.result.title}）` : ''
                        content = `**${siteName}${pageTitle}** から取得:\n\n${result.result.content}`
                      } else if ((result.actionType === 'cdp_register' || result.actionType === 'cdp_update_login') && result.result?.message) {
                        content = result.result.message
                      }
                      // 画像/動画をフィールドに分離
                      let msgImages: string[] | undefined
                      let msgVideos: string[] | undefined
                      if (result.actionType === 'generate_image' && result.result?.images) {
                        msgImages = result.result.images.split('|||')
                      }
                      if (result.actionType === 'generate_video' && result.result?.video) {
                        msgVideos = [result.result.video]
                      }
                      setMessages(prev => [...prev, {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        agent_id: 'action',
                        content,
                        images: msgImages,
                        videos: msgVideos,
                        created_at: new Date().toISOString(),
                      }])
                    } else if (result.error) {
                      // 2FAが必要な場合はリトライボタンを表示
                      if (result.result?.needs_2fa === 'true') {
                        setTwoFaRetry({ actionId, siteName: result.result.site_name ?? 'サイト' })
                        playNotificationSound('attention')
                      }
                      setMessages(prev => [...prev, {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        agent_id: 'action',
                        content: result.error ?? 'エラーが発生しました',
                        created_at: new Date().toISOString(),
                      }])
                    }
                  }}
                  submittedChoices={submittedChoices}
                  onChoiceSubmit={(groupId, selected) => {
                    setSubmittedChoices(prev => ({ ...prev, [groupId]: selected }))
                    handleChatSubmit(selected.join(', '), localStorage.getItem('agent-hub-base-model') ?? 'gemini-flash', [])
                  }}
                />
              ))}
              {streamingContent && (
                <UnifiedMessage
                  message={{
                    id: 'streaming',
                    role: 'assistant',
                    content: cleanMessageTags(streamingContent),
                    agentLabel: AGENT_LABEL,
                  }}
                  isStreaming
                />
              )}
              {/*
                応答中は常時 StatusIndicator を表示 (Claude Code 風)。
                テキストストリームが進行中でも、その下に "経過 12s · 250 tokens · 回答を生成中..." を出して
                "動いている証拠" を保証する。
              */}
              {loading && (
                <StatusIndicator
                  status={progress?.label ?? currentStatus ?? '考え中...'}
                  phase={progress?.phase}
                  elapsedMs={progress?.elapsedMs}
                  outputTokens={progress?.outputTokens}
                  onAbort={handleAbort}
                />
              )}
            </div>
          )}
        </div>

        {/* SQL 自動承認バナー (sqlAutoApprove=true の時のみ表示、解除リンク付き) */}
        {sqlAutoApprove && (
          <div className="px-4 pt-2">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
              <span>
                ⚡ このセッション中、SQL 実行の承認確認は省略されます
              </span>
              <button
                type="button"
                onClick={() => setSqlAutoApprove(false)}
                className="text-amber-800 underline hover:text-amber-900"
              >
                解除する
              </button>
            </div>
          </div>
        )}

        {/* 入力エリア
            key に conversationId を含めることで、新規チャット (null) や別の会話に切り替えた時に
            ChatInput を強制再マウントし、ツール選択 / 添付ファイル / 入力中テキストをデフォルトにリセットする。
            forcedTool: レポート Canvas が開いている時は draft_revise を自動オンにし、
            ユーザーの送信メッセージを「ドラフトへの修正指示」として扱わせる。
            ただし conversationId が null (= 新規チャット) の間は、前のセッションの hasDraft が
            非同期 useEffect でクリアされる前に ChatInput が再マウントしてしまうレースを避けるため、
            forcedTool を必ず null に固定する。新規セッションで draft_revise が誤選択される事故防止。 */}
        <ChatInput
          key={conversationId ?? 'new'}
          onSubmit={handleChatSubmit}
          loading={loading}
          onAbort={handleAbort}
          placeholder="質問を入力 (Enter で送信、Shift+Enter で改行)"
          showModelSelector
          prefill={chatPrefill}
          forcedTool={
            // Canvas 文脈に応じて、ドラフト編集 (skeleton) と レポート編集 (生成済み本文) を切り替え:
            // - レポート生成済み + 現在 result タブ表示中 → 'result_edit' (Gemini で本文書き換え)
            // - それ以外 (ドラフトタブ表示中 or まだレポート未生成) → 'draft_revise' (skeleton 編集)
            conversationId && canvasOpen && hasDraft
              ? canvasView.view === 'result' && canvasView.hasResult
                ? 'result_edit'
                : 'draft_revise'
              : null
          }
          /* Canvas が開いている時はドラフト修正/作成経路 = Gemini Flash 直叩きに固定。
             モデルセレクタを操作不能にして「Gemini 2.5 Flash (固定)」と表示する。
             Canvas を閉じれば通常のモデル選択に戻る。
             注: conversationId はチェックしない (新規チャット送信瞬間にはまだ null だが、
             handleChatSubmit が setHasDraft(true)+setCanvasOpen(true) するので
             ここで発火してほしい) */
          forcedModelLabel={
            canvasOpen && hasDraft ? 'Gemini 2.5 Flash (固定)' : null
          }
        />
      </div>

      {/* レポート Canvas (右ペイン) — 境界ドラッグでリサイズ可能 */}
      {canvasOpen && hasDraft && (
        <>
          {/* リサイザ (チャット領域と Canvas の境界) */}
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={(e) => { e.preventDefault(); setResizingCanvas(true) }}
            className={cn(
              // デフォルトは背景と同色 (見えない) → hover / drag で色付け
              'hidden lg:block w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-blue-400/60 transition-colors',
              resizingCanvas && 'bg-blue-500'
            )}
            title="ドラッグして幅を調整"
          />
          <div
            className="hidden lg:flex shrink-0 flex-col min-h-0 bg-slate-100 p-2.5 h-screen"
            style={{ width: `${canvasWidth}px` }}
          >
            <ReportCanvas
              sessionId={conversationId}
              chatPhase={reportChatPhase}
              discardEditTrigger={discardCanvasEditTrigger}
              onViewChange={setCanvasView}
              onReportGenerated={reloadCurrentMessages}
              liveStatusText={currentStatus}
              onCancelChatStream={handleAbort}
              chatLoading={loading}
              onClose={() => {
                // Canvas を閉じるだけ。hasDraft は触らない。
                // 以前は setHasDraft(false) もしていたが、これだと
                // ヘッダーの「Canvas を開く」トグルボタン (hasDraft 条件で表示) が
                // 消えてしまい、ユーザーが Canvas を再度開けなくなるバグがあった。
                // DB 上のドラフトは閉じても残っているので、ボタンは出し続けて OK。
                setCanvasOpen(false)
              }}
            />
          </div>
        </>
      )}

      <SqlApprovalModal
        open={!!pendingSqlApproval}
        request={pendingSqlApproval}
        onCancel={() => setPendingSqlApproval(null)}
        onApprove={(skipForSession) => {
          if (skipForSession) setSqlAutoApprove(true)
          setPendingSqlApproval(null)
          // 次の1リクエストだけ強制承認 (state 反映待ちを ref でバイパス)
          sqlApproveOnceRef.current = true
          // 承認後の再開:
          // - 直前にユーザーが投げた質問の文脈は Anthropic 側に履歴として残っている。
          // - 「お願いします」とだけ送ると LLM は同じ意図で execute_sql を再呼び出しする。
          handleChatSubmit(
            'お願いします',
            resolveBaseModelId(),
            []
          )
        }}
      />
    </div>
  )
}
