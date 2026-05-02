'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2, Plus, MessageSquare, PanelRightClose, PanelRightOpen, Trash2, Sun, Settings as SettingsIcon, LogOut, Bot, ShieldCheck, RefreshCw, FileText } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/src/components/ui/shadcn/button'
import { ScrollArea } from '@/src/components/ui/shadcn/scroll-area'
import { cn } from '@/src/lib/cn'
import { UnifiedMessage, cleanMessageTags, parseChoices, type ChoiceGroup } from '@/src/components/advisor/chat/unified-message'
import { ChatInput, type AttachedFile } from '@/src/components/advisor/chat/chat-input'
import { StatusIndicator } from '@/src/components/advisor/chat/status-indicator'
import { getConversations, getConversationMessages, deleteConversation, type ConversationSummary } from '@/src/lib/advisor/actions/conversations'
import { getPinnedAgents, getCAConversations, deleteCAConversation, type CustomAgent, type CAConversationSummary } from '@/src/lib/advisor/actions/custom-agents'
import { getAgentIcon, ICON_COLORS } from '@/src/lib/advisor/agent-icons'
import { approveAction } from '@/src/lib/advisor/actions/pending-actions'
import { DEFAULT_MODEL_ID } from '@/src/lib/advisor/models'
import { ReportCanvas } from '@/src/components/advisor/report/report-canvas'
import { getDraftForSession } from '@/src/lib/advisor/actions/report-drafts'

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

  // URL の ?c=<id> から初期会話を開く (履歴ページからの遷移用)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const cid = params.get('c')
    if (cid) {
      handleSelectConversation(cid)
      // 履歴復元後は URL をきれいに戻す
      window.history.replaceState({}, '', '/system-admin/advisor')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    setLoading(true)
    const msgs = await getConversationMessages(id)
    setMessages(msgs.map(m => ({
      id: m.id,
      role: m.role as Message['role'],
      agent_id: m.agent_id ?? undefined,
      content: m.content,
      created_at: m.created_at,
    })))
    setLoading(false)
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
    files?: { name: string; mimeType: string; base64: string }[]
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
      }
      // tool_use / tool_result / usage は UI で消費する余地があるが今は無視
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

      setMessages(prev => [...prev, {
        id: result.data?.messageId ?? crypto.randomUUID(),
        role: 'assistant',
        agent_id: agentId,
        content: cleanContent,
        created_at: new Date().toISOString(),
        actionIds: actionIds.length > 0 ? actionIds : undefined,
        choices: choices.length > 0 ? choices : undefined,
        sources: result.sources.length > 0 ? result.sources : undefined,
      }])
      setStreamingContent('')

      // 今回の応答で update_report_draft が呼ばれていたら Canvas を自動オープン
      if (result.sources.includes('update_report_draft')) {
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
      {/* 会話サイドバー */}
      <div className="hidden md:flex w-64 border-r border-slate-200 bg-slate-50 flex-col shrink-0">
        <div className="p-3 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg bg-slate-800 text-white flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold text-slate-800">System Advisor</div>
          </div>
          <Button
            size="sm"
            className="w-full gap-1.5 text-xs rounded-full bg-slate-800 hover:bg-slate-900 text-white"
            onClick={handleNewChat}
          >
            <Plus className="h-3.5 w-3.5" />
            新規chat
          </Button>
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
                  <span className="truncate flex-1 text-xs">{conv.title ?? '新しい会話'}</span>
                  <span className="text-[9px] text-slate-400 shrink-0 group-hover:hidden">
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
        <div className="border-t border-slate-200 p-2 space-y-0.5">
          {conversations.length > 0 && (
            <Link
              href="/system-admin/advisor/history"
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              すべての履歴を見る
            </Link>
          )}
          <Link
            href="/system-admin/advisor/reports"
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            レポート履歴
          </Link>
        </div>
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
                ? conversations.find(c => c.id === conversationId)?.title ?? '会話'
                : '新しい会話'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* レポート Canvas トグル: ドラフトが存在する時だけ表示 */}
            {hasDraft && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCanvasOpen(v => !v)}
                className="h-7 px-2 gap-1 text-xs text-slate-600 hover:text-slate-900"
                title={canvasOpen ? 'レポート Canvas を閉じる' : 'レポート Canvas を開く'}
              >
                {canvasOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                <FileText className="h-3.5 w-3.5" />
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
                    { label: 'ログの集計を依頼したい', message: '直近のログを集計して、エラーやアクセス傾向の概要を教えてください。' },
                    { label: '追加機能を検討したい', message: '新しい機能の追加を検討しています。技術的に可能か、影響範囲を含めて教えてください。' },
                    { label: 'システムや仕様について聞きたい', message: 'TASTAS の仕様や実装について質問させてください。' },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={() => handleChatSubmit(item.message, DEFAULT_MODEL_ID, [], undefined)}
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

        {/* 入力エリア */}
        <ChatInput
          onSubmit={handleChatSubmit}
          loading={loading}
          onAbort={handleAbort}
          placeholder="質問を入力 (Enter で送信、Shift+Enter で改行)"
          showModelSelector
        />
      </div>

      {/* レポート Canvas (右ペイン) */}
      {canvasOpen && hasDraft && (
        <div className="hidden lg:flex w-[420px] border-l border-slate-200 shrink-0 flex-col">
          <ReportCanvas
            sessionId={conversationId}
            onClose={() => {
              setCanvasOpen(false)
              setHasDraft(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
