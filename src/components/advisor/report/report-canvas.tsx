'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, FileText, RefreshCw, Trash2, Sparkles, Copy, Check, AlertCircle, X, Pencil, ChevronDown, History, Link2, Link2Off, Share2, Bookmark, BookmarkCheck, MoreHorizontal } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { normalizeMarkdown } from '@/src/lib/advisor/markdown-normalize'

/**
 * ReactMarkdown 共通カスタム components。
 * - 「*出典: ...*」の italic 行をグレー + 小フォントで表示する
 * - グローバル CSS で ul のリストスタイルがリセットされているため、
 *   ul/ol/li を明示的にスタイル付け (bullet が消えて箇条書きに見えない問題への対処)
 */
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
          className="block text-[10px] text-slate-400 mt-1 mb-2 not-italic"
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
}
import { Button } from '@/src/components/ui/shadcn/button'
import { ScrollArea } from '@/src/components/ui/shadcn/scroll-area'
import {
  getDraftForSession,
  clearDraftForSession,
  updateDraftBulk,
  type ClientDraftSummary,
} from '@/src/lib/advisor/actions/report-drafts'
import { METRIC_CATALOG } from '@/src/lib/advisor/tools/tastas-data/metrics-catalog'
import {
  listVersionsForSession,
  getVersionDetail,
  lockEditing,
  releaseEditing,
  saveManualEdit,
  getShareState,
  enableShare,
  disableShare,
  extendShare,
  type ClientVersionSummary,
  type ClientVersionDetail,
} from '@/src/lib/advisor/actions/report-versions'
import {
  toggleBookmark,
  getSessionBookmarkState,
} from '@/src/lib/advisor/actions/conversations'

/**
 * レポート用データソースの選択肢 (チェックボックス UI に使う)。
 * collect.ts の buildInputFor で対応している toolKey と 1:1 対応。
 * 未対応の toolKey をユーザーが選んでもレポート生成時に skipped になるだけで害はないが、
 * 混乱を避けるためここで明示的にリスト化する。
 */
const REPORT_DATA_SOURCE_OPTIONS: Array<{ key: string; label: string; description: string }> = [
  { key: 'query_metric', label: '本番 DB 指標集計', description: 'TASTAS 内部の数値 (登録数, LP_PV など)' },
  { key: 'query_ga4', label: 'GA4 アクセス解析', description: 'ページビュー / 流入元 / セッション' },
  { key: 'query_search_console', label: 'Search Console', description: '検索クエリ / 順位 / CTR' },
  { key: 'get_jobs_summary', label: '求人サマリ', description: '求人テーブルの現状スナップショット' },
  { key: 'get_users_summary', label: 'ユーザーサマリ', description: 'ワーカー/管理者の総数や状態' },
  { key: 'get_recent_errors', label: 'エラーログ (DB)', description: '直近のシステムエラー記録' },
  { key: 'get_supabase_logs', label: 'Supabase ログ', description: 'Auth / Postgres ログ' },
  { key: 'get_vercel_logs', label: 'Vercel ログ', description: 'ランタイムログ' },
  { key: 'get_vercel_deployments', label: 'Vercel デプロイ履歴', description: '直近のデプロイ状況' },
  { key: 'get_recent_commits', label: 'GitHub コミット履歴', description: '直近のコミット (背景把握用)' },
]

export interface ReportCanvasProps {
  sessionId: string | null
  onClose?: () => void
  /**
   * 親 (chat-layout) から渡される「いま何の処理が走っているか」のヒント。
   * Canvas 内で適切な進行中メッセージを出すために使う。
   * - 'drafting': レポート作成ツールを送信した直後 (Claude がドラフトを書いている)
   * - 'updating': 既存ドラフトに対して LLM が修正を適用中
   * - 'idle': 何も走っていない
   */
  chatPhase?: 'idle' | 'drafting' | 'updating'
  /**
   * チャット送信のたびに親が +1 して渡すカウンター。
   * 値が変化したら Canvas のローカル未保存編集 (draftEdit) を破棄して
   * Claude による DB 更新の反映を妨げないようにする。
   */
  discardEditTrigger?: number
  /**
   * Canvas 内部のタブ ('draft' | 'result') が切り替わったり、結果有無が変わるたびに通知。
   * chat-layout はこれを使って ChatInput の forcedTool を切り替える。
   * - view='draft' → draft_revise (skeleton 編集)
   * - view='result' && hasResult → result_edit (生成済みレポート編集)
   */
  onViewChange?: (info: { view: 'draft' | 'result'; hasResult: boolean }) => void
  /**
   * レポート生成 (Canvas 内の手動ボタン) が完了したタイミングで呼ぶ。
   * chat-layout 側で `getConversationMessages` を再取得して、
   * 「📊 レポート v1 を生成しました」のサーバー側永続化メッセージを画面に表示する。
   */
  onReportGenerated?: () => void
  /**
   * SSE で来る最新 status テキスト (例: 'ドラフトを更新中...', 'レポートを再生成中...')。
   * 渡されているとき、Canvas のステータスバーは chatPhase の固定文ではなくこちらを優先表示する。
   * 「レポート生成中」が固定で出続ける問題の解消用。
   */
  liveStatusText?: string | null
  /**
   * チャット送信中 (drafting / updating) の時に Canvas ヘッダーの「中止」ボタンから
   * SSE ストリームを停止する関数。chat-layout の handleAbort を渡す。
   */
  onCancelChatStream?: () => void
  /**
   * 親 (chat-layout) のローカルローディング状態。drafting / updating 中の中止ボタンの
   * 表示判定 (= ストリームが本当に動いているかの確認) に使う。
   */
  chatLoading?: boolean
}

/**
 * 右側 Canvas: チャットで固めたレポートドラフトを表示。
 * - LLM が `update_report_draft` を呼ぶたびに DB が書き換わるので、
 *   このコンポーネントは 2 秒間隔で軽くポーリングして反映する
 * - 「レポート作成」ボタン押下で /api/advisor/report/generate を叩く
 * - 結果が出たら同じ Canvas に Markdown を表示
 */
export function ReportCanvas({
  sessionId,
  onClose,
  chatPhase = 'idle',
  discardEditTrigger = 0,
  onViewChange,
  onReportGenerated,
  liveStatusText = null,
  onCancelChatStream,
  chatLoading = false,
}: ReportCanvasProps) {
  const [draft, setDraft] = useState<ClientDraftSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<'draft' | 'result'>('draft')
  // P1-3 / P1-9: バージョン管理
  const [versions, setVersions] = useState<ClientVersionSummary[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [activeVersion, setActiveVersion] = useState<ClientVersionDetail | null>(null)
  const [versionMenuOpen, setVersionMenuOpen] = useState(false)
  // P1-9: 手動編集モード (result の本文を Markdown 直接編集)
  const [editing, setEditing] = useState(false)
  const [editingText, setEditingText] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  // ドラフト本体の Markdown 直接編集モード (DraftBodyView 内の textarea のトグル)
  const [draftBodyEditing, setDraftBodyEditing] = useState(false)
  // ドラフト要件のローカル編集状態 (フィールドを直接編集 → 「ドラフト更新」ボタンで一括保存)
  // null は「未編集 (DB と同じ)」を意味する
  const [draftEdit, setDraftEdit] = useState<{
    title: string
    goal: string
    rangeStart: string
    rangeEnd: string
    dataSources: string[]
    metricKeys: string[]
    outline: string
    notes: string
  } | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null)
  // 公開シェア URL (URL を知っている人なら閲覧可)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareUntil, setShareUntil] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  // セッションのしおり (永続保存) 状態
  const [bookmarked, setBookmarked] = useState(false)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [sessionUpdatedAt, setSessionUpdatedAt] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)
  const generateAbortRef = useRef<AbortController | null>(null)
  // セッション切替時の初期 view 決定 (一度だけ): result があれば 'result'、無ければ 'draft'
  const initialViewDecidedForSessionRef = useRef<string | null>(null)
  const shareMenuRef = useRef<HTMLDivElement | null>(null)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)

  const reload = useCallback(async () => {
    if (!sessionId) {
      setDraft(null)
      setVersions([])
      setActiveVersionId(null)
      setActiveVersion(null)
      return
    }
    // 編集中はポーリングで上書きしない (admin の編集テキストが消える事故を防ぐ)
    if (editing) return
    // ドラフト要件をユーザーが書き換え中ならポーリング上書きしない
    if (draftEdit !== null) return
    const [d, vs] = await Promise.all([
      getDraftForSession(sessionId),
      listVersionsForSession(sessionId),
    ])
    setDraft(d)
    setVersions(vs)

    // active version の選定: **常に最新 (vs[0]) を表示する**。
    //   ユーザーが過去バージョンを意図的に選んでドロップダウンで切り替える場合は、
    //   別途 versionMenuOpen UI で明示的に setActiveVersionId するため、ここでは最新固定で OK。
    //   旧仕様 (既選択を維持) だと revise / 自動再生成で新バージョンが出てもユーザーが古い v を見続ける事故があった。
    const next = vs[0] ?? null
    if (next?.id !== activeVersionId) {
      setActiveVersionId(next?.id ?? null)
    }

    // セッションを開いた直後の初期 view 決定 (1 セッションにつき 1 回だけ):
    //   過去のチャットで生成済みレポートを開いたら最初から result タブを開く。
    //   ユーザーが意図的に draft タブを押した後は再切替しない (ref で記録済み)。
    if (initialViewDecidedForSessionRef.current !== sessionId) {
      initialViewDecidedForSessionRef.current = sessionId
      if (d?.resultMarkdown) {
        setView('result')
      } else {
        setView('draft')
      }
    }

    // 結果がある状態でドラフトが新しく更新されたら、ユーザーが Canvas を見ている時の表示は draft に戻す
    // ただし完了直後 (generating だった→completed) は result を表示
    if (d?.status === 'completed' && d.resultMarkdown && view === 'draft' && generating) {
      setView('result')
    }

    // 新バージョンが追加された (auto-redraft+regenerate or 手動再生成完了) → result タブに切り替え。
    // 旧 stale 検知 (updatedAt > generatedAt) は auto-redraft の場合に誤発火するので削除。
    const newestVersionCreatedAt = vs[0]?.createdAt ? new Date(vs[0].createdAt).getTime() : 0
    if (
      view === 'draft' &&
      d?.resultMarkdown &&
      newestVersionCreatedAt > 0 &&
      Date.now() - newestVersionCreatedAt < 8_000 // 直近 8 秒以内に新バージョン作成された
    ) {
      setView('result')
    }

    // ドラフトが result 生成後に更新されたら (stale) → タブ脇のドット表示で示す。
    // ただし view 自動切替は **しない** (ユーザーがレポート見てる視点を維持するため)。
    // 切替したい時はユーザーがタブを押す。stale バッジで気付ける。
  }, [sessionId, view, generating, editing, activeVersionId, draftEdit])

  /**
   * 親から discardEditTrigger が変化したら Canvas のローカル未保存編集を破棄。
   * チャット送信が走った瞬間に呼ばれ、これ以降 Claude の DB 更新がポーリングで反映される。
   * 初回マウント (0 のまま) は無視する。
   */
  const lastDiscardTriggerRef = useRef(discardEditTrigger)
  useEffect(() => {
    if (discardEditTrigger !== lastDiscardTriggerRef.current) {
      lastDiscardTriggerRef.current = discardEditTrigger
      if (draftEdit !== null) {
        setDraftEdit(null)
        setDraftSaveError(null)
      }
    }
  }, [discardEditTrigger, draftEdit])

  // active version 詳細をロード (id 変更時のみ)
  useEffect(() => {
    let cancelled = false
    if (!activeVersionId) {
      setActiveVersion(null)
      return
    }
    getVersionDetail(activeVersionId).then((v) => {
      if (!cancelled) setActiveVersion(v)
    })
    return () => {
      cancelled = true
    }
  }, [activeVersionId])

  // active version 切替時にシェア状態を取得
  useEffect(() => {
    let cancelled = false
    setShareToken(null)
    setShareUntil(null)
    setShareError(null)
    setShareCopied(false)
    setShareMenuOpen(false)
    if (!activeVersionId) return
    getShareState(activeVersionId).then((res) => {
      if (cancelled || !res.ok) return
      setShareToken(res.shared ? res.token : null)
      setShareUntil(res.shared ? res.sharedUntil : null)
    })
    return () => {
      cancelled = true
    }
  }, [activeVersionId])

  // セッション切替時にしおり状態をロード
  useEffect(() => {
    let cancelled = false
    setBookmarked(false)
    setSessionUpdatedAt(null)
    if (!sessionId) return
    getSessionBookmarkState(sessionId).then((res) => {
      if (cancelled || !res) return
      setBookmarked(res.bookmarked)
      setSessionUpdatedAt(res.updatedAt)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // 共有ドロップダウンの outside click で閉じる
  useEffect(() => {
    if (!shareMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShareMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [shareMenuOpen])

  // その他 (⋯) メニューの outside click で閉じる
  useEffect(() => {
    if (!moreMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [moreMenuOpen])

  // view ('draft' | 'result') と「結果有無」の組み合わせを親に通知。
  // chat-layout はこれを使って ChatInput の forcedTool を切り替える:
  //   - view='draft'  → forcedTool='draft_revise'  (skeleton 編集)
  //   - view='result' && resultMarkdown あり → forcedTool='result_edit' (本文編集)
  useEffect(() => {
    onViewChange?.({ view, hasResult: !!draft?.resultMarkdown })
  }, [view, draft?.resultMarkdown, onViewChange])

  useEffect(() => {
    setLoading(true)
    reload().finally(() => setLoading(false))
    // 段階的ポーリング:
    //   アクティブ時 (チャット送信中 / drafting / updating / generating) は 2 秒間隔で進捗反映
    //   idle 時は 8 秒間隔で軽量化 (最悪 8 秒以内に最新化される)
    //
    // 「停止」は絶対にしない: ユーザーが Canvas を見ているだけの状態でも、別タブで
    // チャット送信した場合などに最新化されないと UX が壊れるため、必ず低頻度でも回す。
    const isActive =
      chatPhase !== 'idle' ||
      chatLoading ||
      generating ||
      draft?.status === 'generating'
    const intervalMs = isActive ? 2000 : 8000
    pollRef.current = window.setInterval(reload, intervalMs)
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [reload, chatPhase, chatLoading, generating, draft?.status])

  async function handleGenerate() {
    if (!sessionId || !draft) return
    setGenerating(true)
    setGenerateError(null)
    const controller = new AbortController()
    generateAbortRef.current = controller
    try {
      const res = await fetch('/api/advisor/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        signal: controller.signal,
      })
      const json = (await res.json()) as
        | { ok: true; resultMarkdown: string }
        | { ok: false; error: string; cancelled?: boolean }
      if (!res.ok || !json.ok) {
        // 499 (cancelled) は静かに何も表示しない (ユーザー操作なので)
        if ('cancelled' in json && json.cancelled) {
          setGenerateError(null)
        } else {
          const msg = !json.ok ? json.error : 'レポート生成に失敗しました'
          setGenerateError(msg)
        }
      } else {
        setView('result')
        // 親 (chat-layout) に「チャット履歴を再取得して」と通知。
        // generate.ts が「📊 レポート vN を生成しました」をサーバー側で
        // appendMessage しているので、これを UI に取り込む。
        onReportGenerated?.()
      }
    } catch (e) {
      // AbortError はユーザー操作なのでエラー表示しない
      if (e instanceof Error && e.name === 'AbortError') {
        setGenerateError(null)
      } else {
        setGenerateError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setGenerating(false)
      generateAbortRef.current = null
      await reload()
    }
  }

  function handleCancelGenerate() {
    if (!generateAbortRef.current) return
    if (!confirm('レポート生成を中止しますか?')) return
    generateAbortRef.current.abort()
  }

  async function handleClear() {
    if (!sessionId) return
    if (!confirm('レポートドラフトを削除しますか?')) return
    await clearDraftForSession(sessionId)
    setDraft(null)
    setView('draft')
    setGenerateError(null)
    setDraftEdit(null)
    onClose?.()
  }

  /**
   * draft が DB から来ている状態と、フォームの編集中状態の両方を扱うユーティリティ。
   * 編集中なら draftEdit、未編集なら draft の値を返す。
   */
  function fieldValue<K extends keyof NonNullable<typeof draftEdit>>(
    key: K
  ): NonNullable<typeof draftEdit>[K] {
    if (draftEdit) return draftEdit[key]
    if (!draft) {
      // フォールバック (描画前のデフォルト)
      const empty = { title: '', goal: '', rangeStart: '', rangeEnd: '', dataSources: [] as string[], metricKeys: [] as string[], outline: '', notes: '' }
      return empty[key as keyof typeof empty] as NonNullable<typeof draftEdit>[K]
    }
    const map = {
      title: draft.title ?? '',
      goal: draft.goal ?? '',
      rangeStart: draft.rangeStart ?? '',
      rangeEnd: draft.rangeEnd ?? '',
      dataSources: draft.dataSources,
      metricKeys: draft.metricKeys,
      outline: draft.outline ?? '',
      notes: draft.notes ?? '',
    }
    return map[key as keyof typeof map] as NonNullable<typeof draftEdit>[K]
  }

  /** ローカル編集状態を初期化または更新 (まだ無ければ draft からコピー) */
  function patchDraftEdit(patch: Partial<NonNullable<typeof draftEdit>>) {
    setDraftSaveError(null)
    setDraftEdit((prev) => {
      const base = prev ?? {
        title: draft?.title ?? '',
        goal: draft?.goal ?? '',
        rangeStart: draft?.rangeStart ?? '',
        rangeEnd: draft?.rangeEnd ?? '',
        dataSources: draft?.dataSources ?? [],
        metricKeys: draft?.metricKeys ?? [],
        outline: draft?.outline ?? '',
        notes: draft?.notes ?? '',
      }
      return { ...base, ...patch }
    })
  }

  /** ドラフト要件を一括保存 (フッターの「ドラフト更新」ボタン) */
  async function handleSaveDraft() {
    if (!sessionId || !draftEdit) return
    setSavingDraft(true)
    setDraftSaveError(null)
    const result = await updateDraftBulk({
      sessionId,
      title: draftEdit.title,
      goal: draftEdit.goal,
      rangeStart: draftEdit.rangeStart,
      rangeEnd: draftEdit.rangeEnd,
      dataSources: draftEdit.dataSources,
      metricKeys: draftEdit.metricKeys,
      outline: draftEdit.outline,
      notes: draftEdit.notes,
    })
    setSavingDraft(false)
    if (!result.ok) {
      setDraftSaveError(result.reason ?? 'ドラフト更新に失敗しました')
      return
    }
    if (result.draft) setDraft(result.draft)
    setDraftEdit(null) // 編集状態クリア → ポーリング再開
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1800)
  }

  // 表示すべき Markdown: 選択中バージョン詳細 → draft の最新版キャッシュ → null
  const displayMarkdown = activeVersion?.resultMarkdown ?? draft?.resultMarkdown ?? null

  function handleCopy() {
    if (!displayMarkdown) return
    navigator.clipboard.writeText(displayMarkdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /** シェア URL を有効化 (token 発行 + URL クリップボードコピー、有効期限 30 日) */
  async function handleEnableShare() {
    if (!activeVersionId) return
    setShareLoading(true)
    setShareError(null)
    try {
      const res = await enableShare(activeVersionId)
      if (!res.ok) {
        setShareError(res.reason ?? 'シェアの有効化に失敗しました')
        return
      }
      setShareToken(res.token)
      setShareUntil(res.sharedUntil)
      const url = `${window.location.origin}/advisor/r/${res.token}`
      try {
        await navigator.clipboard.writeText(url)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      } catch {
        // クリップボード失敗は致命ではない
      }
    } finally {
      setShareLoading(false)
    }
  }

  /** シェア URL を停止 (shared_at / shared_until = null) */
  async function handleDisableShare() {
    if (!activeVersionId) return
    if (!confirm('共有 URL を停止しますか? 既に URL を共有した相手はアクセスできなくなります')) return
    setShareLoading(true)
    setShareError(null)
    try {
      const res = await disableShare(activeVersionId)
      if (!res.ok) {
        setShareError(res.reason ?? 'シェアの停止に失敗しました')
        return
      }
      setShareToken(null)
      setShareUntil(null)
    } finally {
      setShareLoading(false)
    }
  }

  /** シェア URL の有効期限を +30 日延長 (token は維持) */
  async function handleExtendShare() {
    if (!activeVersionId) return
    setShareLoading(true)
    setShareError(null)
    try {
      const res = await extendShare(activeVersionId)
      if (!res.ok) {
        setShareError(res.reason ?? '延長に失敗しました')
        return
      }
      setShareUntil(res.sharedUntil)
    } finally {
      setShareLoading(false)
    }
  }

  /** シェア URL をクリップボードにコピー (有効化済みの場合) */
  async function handleCopyShareUrl() {
    if (!shareToken) return
    const url = `${window.location.origin}/advisor/r/${shareToken}`
    await navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  /** しおりトグル (永続保存 ON/OFF) */
  async function handleToggleBookmark() {
    if (!sessionId) return
    setBookmarkLoading(true)
    try {
      const res = await toggleBookmark(sessionId)
      if (res.ok) setBookmarked(res.bookmarked)
    } finally {
      setBookmarkLoading(false)
    }
  }

  // === P1-9 手動編集モード ===

  async function handleStartEdit() {
    if (!activeVersion) return
    const lock = await lockEditing(activeVersion.id)
    if (!lock.ok) {
      setEditError(lock.reason)
      setTimeout(() => setEditError(null), 4000)
      return
    }
    setEditingText(activeVersion.resultMarkdown)
    setEditing(true)
    setEditError(null)
  }

  async function handleCancelEdit() {
    if (!activeVersion) return
    if (
      editingText !== activeVersion.resultMarkdown &&
      !confirm('編集を破棄しますか? 保存されていない変更は失われます')
    ) {
      return
    }
    await releaseEditing(activeVersion.id)
    setEditing(false)
    setEditingText('')
    setEditError(null)
  }

  async function handleSaveEdit() {
    if (!activeVersion) return
    if (editingText.trim().length === 0) {
      setEditError('本文が空です')
      return
    }
    if (editingText === activeVersion.resultMarkdown) {
      // 変更なし → ロック解除して終了
      await releaseEditing(activeVersion.id)
      setEditing(false)
      setEditError(null)
      return
    }
    setSavingEdit(true)
    setEditError(null)
    const result = await saveManualEdit({
      parentVersionId: activeVersion.id,
      newMarkdown: editingText,
    })
    setSavingEdit(false)
    if (!result.ok) {
      setEditError(result.reason)
      return
    }
    // 保存成功: 新バージョンに切替
    setEditing(false)
    setEditingText('')
    setActiveVersionId(result.version.id)
    await reload()
  }

  // 早期 return (sessionId なし / DB ロード中 / draft 未作成 のいずれか) を統合。
  // 楽観的 UI: chatPhase が動いている (drafting/updating) or chatLoading なら、
  // ドラフトが DB に書かれる前から「作成中」ヘッダーを出す。Canvas を開いた瞬間に表示される。
  if (!sessionId || (loading && !draft) || !draft) {
    const optimisticActive = chatPhase !== 'idle' || chatLoading
    return (
      <div className="h-full min-h-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {optimisticActive ? (
          <div className="h-11 border-b flex items-center px-3 gap-2 shrink-0 bg-slate-50/50">
            <Loader2 className="h-4 w-4 text-slate-700 shrink-0 animate-spin" />
            <span className="text-sm font-medium text-slate-700 truncate">
              {liveStatusText ?? (chatPhase === 'updating' ? 'ドラフトを更新中...' : 'ドラフトを作成中...')}
            </span>
            {chatLoading && onCancelChatStream ? (
              <button
                type="button"
                onClick={onCancelChatStream}
                className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-red-600 hover:bg-red-50 border border-red-100"
                title="ドラフト処理を中止"
              >
                <X className="h-3 w-3" />
                中止
              </button>
            ) : onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="ml-auto h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="閉じる"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : (
          <div className="h-11 border-b flex items-center justify-between px-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-slate-700 shrink-0" />
              <span className="text-sm font-semibold text-slate-800 truncate">レポートプレビュー</span>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="閉じる"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <ScrollArea className="flex-1 min-h-0">
          <PreviewSkeleton />
        </ScrollArea>
      </div>
    )
  }

  const canGenerate = draft.dataSources.length > 0 && draft.status !== 'generating'
  const hasResult = !!draft.resultMarkdown
  // レポート生成後にドラフトが更新された (= stale) → タブにドット + 結果ビューにバッジ
  const draftIsStale =
    !!draft.generatedAt &&
    new Date(draft.updatedAt).getTime() > new Date(draft.generatedAt).getTime() + 500

  // ドラフト編集中 / 生成中 / アイドルを動的に判定して Canvas 上部のアニメーション帯に渡す。
  const liveStatus: 'generating' | 'drafting' | 'updating' | 'idle' =
    draft.status === 'generating' || generating
      ? 'generating'
      : chatPhase === 'drafting'
      ? 'drafting'
      : chatPhase === 'updating'
      ? 'updating'
      : 'idle'

  return (
    <div className="h-full min-h-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ヘッダー: 全機能を 1 行に集約 (Gemini Canvas 風)
          - 編集中 / 生成中 / ドラフト作成中 / ドラフト更新中 はミニマルな状態専用ヘッダー
          - 通常時は タイトル / タブ / バージョン / アクション / その他 / 閉じる */}
      {editing ? (
        <div className="h-11 border-b flex items-center px-3 gap-2 shrink-0 bg-slate-50/50">
          <FileText className="h-4 w-4 text-slate-700 shrink-0" />
          <span className="text-sm font-semibold text-slate-800 truncate">編集中</span>
          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold tracking-wider uppercase border border-amber-200">
            EDIT
          </span>
          <div className="ml-auto flex items-center gap-1">
            <IconButton onClick={handleCancelEdit} disabled={savingEdit} title="編集をキャンセル">
              <X className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton onClick={handleSaveEdit} disabled={savingEdit} title="保存 (新バージョンとして)" tone="primary">
              {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </IconButton>
          </div>
        </div>
      ) : liveStatus !== 'idle' ? (
        // 生成中 / ドラフト作成中 / ドラフト更新中 共通の状態専用ヘッダー
        (() => {
          const label =
            liveStatus === 'generating'
              ? 'レポートを生成中...'
              : liveStatus === 'drafting'
              ? 'ドラフトを作成中...'
              : 'ドラフトを更新中...'
          // 中止ボタン:
          //   - generating: Canvas 内 Gemini 直叩き (handleCancelGenerate で abort)
          //   - drafting / updating: chat-layout 側の SSE ストリーム (onCancelChatStream で abort)
          const onCancel =
            liveStatus === 'generating'
              ? (generateAbortRef.current ? handleCancelGenerate : null)
              : (chatLoading && onCancelChatStream ? onCancelChatStream : null)
          return (
            <div className="h-11 border-b flex items-center px-3 gap-2 shrink-0 bg-slate-50/50">
              <Loader2 className="h-4 w-4 text-slate-700 shrink-0 animate-spin" />
              <span className="text-sm font-medium text-slate-700 truncate">
                {liveStatusText ?? label}
              </span>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-red-600 hover:bg-red-50 border border-red-100"
                  title={liveStatus === 'generating' ? '生成を中止' : 'ドラフト処理を中止'}
                >
                  <X className="h-3 w-3" />
                  中止
                </button>
              )}
            </div>
          )
        })()
      ) : (
        <div className="h-11 border-b flex items-center px-3 gap-1.5 shrink-0">
          {/* 左: アイコン + タイトル + バッジ */}
          <FileText className="h-4 w-4 text-slate-700 shrink-0" />
          <span
            className="text-sm font-semibold text-slate-800 shrink-0"
            title={draft.title || 'レポートドラフト'}
          >
            {shortTitle(draft.title || 'レポートドラフト')}
          </span>
          {/* draft <-> result 切替: 選択中の側に色を付ける (draft=赤系, result=青系)。
              hasResult が無くても「ドラフト」タブを表示してステータスを示す。 */}
          <div className="shrink-0 ml-1 inline-flex bg-slate-100 rounded-md p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setView('draft')}
              className={`px-2.5 py-0.5 rounded transition-colors ${
                view === 'draft'
                  ? 'bg-red-100 text-red-700 font-medium shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="ドラフトを表示 (要件 + 0 埋めの骨格)"
            >
              ドラフト
              {draftIsStale && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />}
            </button>
            {hasResult && (
              <button
                type="button"
                onClick={() => setView('result')}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  view === 'result'
                    ? 'bg-blue-100 text-blue-700 font-medium shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="レポートを表示 (本文 + 数値)"
              >
                レポート
              </button>
            )}
          </div>

          {/* バージョンドロップダウン (result + 複数バージョンあり) — タブの右に配置 */}
          {hasResult && view === 'result' && versions.length > 0 && (
            <div className="relative shrink-0 ml-1">
              <button
                type="button"
                onClick={() => setVersionMenuOpen(!versionMenuOpen)}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] rounded-md text-slate-600 hover:bg-slate-100 border border-slate-200"
                title="バージョン切替"
              >
                v{activeVersion?.versionNumber ?? draft.generationCount}
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>
              {versionMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setVersionMenuOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {versions.map((v) => {
                      const isActive = v.id === activeVersionId
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setActiveVersionId(v.id)
                            setVersionMenuOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-slate-50 ${
                            isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                          }`}
                        >
                          <span className="truncate">{formatVersionLabel(v)}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {sourceLabel(v.source)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 中央スペーサー */}
          <div className="flex-1" />

          {/* 右: result 時は「編集 → レポート更新 → 共有」の順
              draft 時は主アクションをヘッダーから外し、その他 + 閉じるのみ */}
          {view === 'result' && hasResult && (
            <>
              {/* 編集 */}
              <IconButton
                onClick={handleStartEdit}
                disabled={!activeVersion || activeVersion.lockedByOther}
                title={
                  activeVersion?.lockedByOther
                    ? '別の管理者が編集中です'
                    : 'このバージョンを直接編集 (保存で新バージョン)'
                }
              >
                <Pencil className="h-3.5 w-3.5" />
              </IconButton>

              {/* レポート更新 — 編集 / 共有と同じくアイコンのみ (マウスオーバーで説明) */}
              <IconButton
                onClick={handleGenerate}
                disabled={!canGenerate}
                title="最新のデータでレポート本文を再生成 (新バージョン)"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </IconButton>

              {/* 共有メニュー */}
              <div className="relative" ref={shareMenuRef}>
                <IconButton
                  onClick={() => setShareMenuOpen((v) => !v)}
                  disabled={shareLoading}
                  title={shareToken ? '共有中 (メニューを開く)' : '共有'}
                  tone={shareToken ? 'emerald' : 'default'}
                >
                  {shareLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                </IconButton>
                {shareMenuOpen && (
                  <div
                    className="absolute top-full right-0 mt-1 w-52 rounded-md border border-slate-200 bg-white shadow-lg z-50 py-1 text-xs"
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { handleCopy(); setShareMenuOpen(false) }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 hover:bg-slate-50 text-left"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copied ? '本文コピー済み' : '本文をコピー'}</span>
                    </button>
                    {shareToken ? (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { handleCopyShareUrl(); setShareMenuOpen(false) }}
                          disabled={shareLoading}
                          className="flex items-center gap-2 w-full px-3 py-2 text-emerald-700 hover:bg-emerald-50 text-left"
                        >
                          {shareCopied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                          <span>{shareCopied ? 'URL コピー済み' : '共有 URL をコピー'}</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={async () => { await handleExtendShare(); setShareMenuOpen(false) }}
                          disabled={shareLoading}
                          className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 hover:bg-slate-50 text-left"
                          title="有効期限を +30 日延長 (token は維持)"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>有効期限を +30 日延長</span>
                        </button>
                        {shareUntil && (
                          <div className="px-3 pb-1.5 text-[10px] text-slate-400">
                            公開期限: あと {Math.max(0, Math.ceil((new Date(shareUntil).getTime() - Date.now()) / 86400000))} 日
                          </div>
                        )}
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={async () => { await handleDisableShare(); setShareMenuOpen(false) }}
                          disabled={shareLoading}
                          className="flex items-center gap-2 w-full px-3 py-2 text-slate-500 hover:bg-red-50 hover:text-red-700 text-left"
                        >
                          <Link2Off className="h-3.5 w-3.5" />
                          <span>共有を停止</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={async () => { await handleEnableShare(); setShareMenuOpen(false) }}
                        disabled={shareLoading || !activeVersionId}
                        className="flex items-center gap-2 w-full px-3 py-2 text-slate-700 hover:bg-slate-50 text-left disabled:opacity-50"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        <span>URL で共有 (30 日)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* draft 表示時: 編集 → レポート作成 (primary、テキスト付き)
              要件メタの保存は要件編集 UI 内の「保存」で行うため、ヘッダーには出さない */}
          {(view === 'draft' || !hasResult) && !generating && (
            <>
              {/* 編集 (skeleton 直接編集の textarea を開く) */}
              <IconButton
                onClick={() => setDraftBodyEditing((v) => !v)}
                disabled={!sessionId}
                title={draftBodyEditing ? 'ドラフト編集を閉じる' : 'ドラフトを編集 (Markdown 直接編集)'}
                tone={draftBodyEditing ? 'amber' : 'default'}
              >
                <Pencil className="h-3.5 w-3.5" />
              </IconButton>

              {/* レポート作成 (主アクション、本文を生成) — テキスト付き primary ボタン */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                title="データを取得して本文 (数値・表・コメント) を生成"
                className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md bg-slate-800 text-white text-xs font-medium hover:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>レポート作成</span>
              </button>
            </>
          )}

          {/* その他メニュー (⋯): 残保存期間 + しおり + 削除 */}
          <div className="relative" ref={moreMenuRef}>
            <IconButton
              onClick={() => setMoreMenuOpen((v) => !v)}
              title="その他のメニュー"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </IconButton>
            {moreMenuOpen && (
              <div
                className="absolute top-full right-0 mt-1 w-64 rounded-md border border-slate-200 bg-white shadow-lg z-50 py-1 text-xs"
                role="menu"
              >
                {/* 1. 保持期間 */}
                <RetentionMenuItem
                  bookmarked={bookmarked}
                  sessionUpdatedAt={sessionUpdatedAt}
                  draftUpdatedAt={draft.updatedAt}
                />
                {/* 2. しおりトグル (保持期間の真下) */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => { await handleToggleBookmark() }}
                  disabled={bookmarkLoading || !sessionId}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-left disabled:opacity-50 ${
                    bookmarked
                      ? 'text-amber-700 hover:bg-amber-50'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  title={
                    bookmarked
                      ? 'しおりを外す (保持期間 30 日が適用されます)'
                      : 'しおりを付けて永続保存にする'
                  }
                >
                  {bookmarkLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : bookmarked ? (
                    <BookmarkCheck className="h-3.5 w-3.5 fill-amber-500 text-amber-600" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5" />
                  )}
                  <span>{bookmarked ? 'しおりを外す' : 'しおりを付けて永続保存'}</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                {/* 3. 削除 */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => { await handleClear(); setMoreMenuOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-slate-600 hover:bg-red-50 hover:text-red-700 text-left"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>ドラフト・レポートを削除</span>
                </button>
              </div>
            )}
          </div>

          {/* 閉じる */}
          {onClose && (
            <IconButton onClick={onClose} title="Canvas を閉じる">
              <X className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </div>
      )}

      {/* 進行中表示はヘッダーに統一済み (drafting / updating / generating すべて) */}

      {/* (旧) stale 警告バナー削除: auto-redraft / 「レポート更新」アイコンが
          自動的に新バージョンを作るので「ユーザーが更新ボタンを押してね」と促す必要なし。
          stale の気付きはタブ脇のドット表示で十分。 */}

      {/* コンテンツ */}
      <ScrollArea className="flex-1 min-h-0">
        {view === 'draft' || !hasResult ? (
          <div className="p-4 space-y-4 text-sm">
            {/* レポート本体ドラフト (skeleton_markdown を表示)。
                view='draft' のときは hasResult に関わらず常に表示する。
                値が無ければ固定の 0 埋め雛形を表示する。 */}
            <DraftBodyView
              title={draft.title}
              skeletonMarkdown={draft.skeletonMarkdown}
              sessionId={sessionId}
              onSaved={(d) => setDraft(d)}
              editing={draftBodyEditing}
              onEditingChange={setDraftBodyEditing}
            />

            {/* レポート要件: 折りたたみ可能 (デフォルト閉じ)。全フィールド常時編集可。フッターの「ドラフト更新」で一括保存。 */}
            <details className="pt-2 mt-2 border-t border-slate-200 group">
              <summary className="cursor-pointer list-none flex items-center justify-between hover:text-slate-600 select-none py-1">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  <ChevronDown className="h-3 w-3 transition-transform -rotate-90 group-open:rotate-0" />
                  レポート要件
                </span>
                {draftEdit !== null && (
                  <span className="text-[10px] text-amber-600 font-medium">未保存の変更</span>
                )}
                {savedFlash && draftEdit === null && (
                  <span className="text-[10px] text-green-600 font-medium inline-flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    保存しました
                  </span>
                )}
              </summary>
              <div className="space-y-4 mt-3">

              {/* タイトル */}
              <FormRow label="タイトル">
                <input
                  type="text"
                  value={fieldValue('title')}
                  onChange={(e) => patchDraftEdit({ title: e.target.value })}
                  placeholder="レポートタイトル"
                  className="w-full text-sm px-2 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </FormRow>

              {/* 目的 */}
              <FormRow label="目的">
                <textarea
                  value={fieldValue('goal')}
                  onChange={(e) => patchDraftEdit({ goal: e.target.value })}
                  placeholder="このレポートで何を明らかにしたいか (1〜2 文)"
                  rows={2}
                  className="w-full text-sm px-2 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-y"
                />
              </FormRow>

              {/* 対象期間 (日付ピッカー) */}
              <FormRow label="対象期間">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={fieldValue('rangeStart')}
                    onChange={(e) => patchDraftEdit({ rangeStart: e.target.value })}
                    className="text-sm px-2 py-1 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <span className="text-slate-400 text-xs">〜</span>
                  <input
                    type="date"
                    value={fieldValue('rangeEnd')}
                    onChange={(e) => patchDraftEdit({ rangeEnd: e.target.value })}
                    className="text-sm px-2 py-1 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
              </FormRow>

              {/* データソース (チェックボックス) */}
              <FormRow label="データソース">
                <div className="grid grid-cols-1 gap-1">
                  {REPORT_DATA_SOURCE_OPTIONS.map((opt) => {
                    const checked = fieldValue('dataSources').includes(opt.key)
                    return (
                      <label
                        key={opt.key}
                        className="flex items-start gap-2 text-xs cursor-pointer hover:bg-slate-50 px-1.5 py-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...fieldValue('dataSources'), opt.key]
                              : fieldValue('dataSources').filter((k) => k !== opt.key)
                            patchDraftEdit({ dataSources: next })
                          }}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-slate-700 font-medium">{opt.label}</div>
                          <div className="text-[10px] text-slate-500">{opt.description}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </FormRow>

              {/* 取得する指標 (data_sources に query_metric が含まれる時のみ表示) */}
              {fieldValue('dataSources').includes('query_metric') && (
                <FormRow label="取得する指標 (本番 DB 指標集計)">
                  <div className="grid grid-cols-1 gap-1">
                    {METRIC_CATALOG.map((m) => {
                      const checked = fieldValue('metricKeys').includes(m.key)
                      const disabled = !m.available
                      return (
                        <label
                          key={m.key}
                          className={`flex items-start gap-2 text-xs px-1.5 py-1 rounded ${
                            disabled
                              ? 'opacity-50 cursor-not-allowed'
                              : 'cursor-pointer hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...fieldValue('metricKeys'), m.key]
                                : fieldValue('metricKeys').filter((k) => k !== m.key)
                              patchDraftEdit({ metricKeys: next })
                            }}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-700 font-medium">{m.label}</span>
                              <code className="text-[10px] text-slate-500 bg-slate-100 px-1 rounded">
                                {m.key}
                              </code>
                              {disabled && (
                                <span className="text-[9px] text-amber-700 bg-amber-50 px-1 rounded">
                                  取得不可
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">{m.description}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </FormRow>
              )}

              {/* アウトライン */}
              <FormRow label="アウトライン">
                <textarea
                  value={fieldValue('outline')}
                  onChange={(e) => patchDraftEdit({ outline: e.target.value })}
                  placeholder={'例:\n## サマリ\n## 主要 KPI\n## 流入分析\n## 次のアクション'}
                  rows={5}
                  className="w-full text-sm px-2 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-y font-mono leading-relaxed"
                />
              </FormRow>

              {/* メモ・追加指示 */}
              <FormRow label="メモ・追加指示">
                <textarea
                  value={fieldValue('notes')}
                  onChange={(e) => patchDraftEdit({ notes: e.target.value })}
                  placeholder="例: 表を3つに分けて(LP別/期間別/セグメント別)。末尾に来週の改善提案を3つ。"
                  rows={4}
                  className="w-full text-sm px-2 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-y leading-relaxed"
                />
              </FormRow>

              {draftSaveError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 flex items-start gap-1.5">
                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>{draftSaveError}</span>
                </div>
              )}
              </div>
            </details>

            {/* 生成中はヘッダーで「⏳ レポートを生成中... + 中止」を表示するためここでは省略 */}
            {(draft.status === 'failed' || generateError) && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div className="min-w-0 break-words">
                  {generateError ?? draft.errorMessage ?? 'レポート生成に失敗しました'}
                </div>
              </div>
            )}
          </div>
        ) : editing ? (
          // 結果ビュー (編集モード)
          <div className="p-4 text-sm flex flex-col h-full">
            <div className="flex items-center gap-2 mb-2 text-[11px] text-slate-500">
              <Pencil className="h-3 w-3" />
              <span>手動編集モード — 保存すると新バージョンになります</span>
            </div>
            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              className="flex-1 min-h-[400px] w-full font-mono text-xs leading-relaxed border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-y"
              spellCheck={false}
            />
            {editError && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                <span className="min-w-0 break-words">{editError}</span>
              </div>
            )}
          </div>
        ) : (
          // 結果ビュー (読み取り)
          <div className="p-4 text-sm">
            <div className="prose prose-sm prose-neutral max-w-none [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h2]:font-semibold [&_h3]:font-medium [&_code]:text-xs [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_table]:text-xs [&_table]:border [&_table]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_th]:border [&_th]:border-slate-200 [&_th]:text-left [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-slate-200">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{normalizeMarkdown(displayMarkdown ?? '')}</ReactMarkdown>
            </div>
            {shareError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                <span className="min-w-0 break-words">{shareError}</span>
              </div>
            )}
            {shareToken && shareCopied && (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-700 flex items-start gap-1.5">
                <Check className="h-3 w-3 shrink-0 mt-0.5" />
                <span className="min-w-0 break-words">共有 URL をコピーしました — URL を知っている人なら誰でも閲覧可</span>
              </div>
            )}
            {editError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                <span className="min-w-0 break-words">{editError}</span>
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-400">
              生成: {activeVersion?.resultModel ?? draft.resultModel ?? 'unknown'} ·{' '}
              {activeVersion?.createdAt ?? draft.generatedAt ?? ''}
              {activeVersion && (
                <>
                  {' '}· {sourceLabel(activeVersion.source)}
                  {activeVersion.lockedByOther && ' · 編集ロック中 (他管理者)'}
                </>
              )}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* フッターは廃止: 編集 / ドラフト更新 / レポート作成 は全てヘッダーに集約済み */}
    </div>
  )
}

function formatVersionLabel(v: { versionNumber: number; createdAt: string; source: string }): string {
  const date = new Date(v.createdAt)
  const m = date.getMonth() + 1
  const d = date.getDate()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `v${v.versionNumber} (${m}/${d} ${hh}:${mm})`
}

/**
 * 保持期間バナー: 「しおりなしのドラフト・レポートは 30 日で削除される」を可視化。
 * - しおりあり: 緑「永続保存中」バッジ
 * - しおりなし + 残り 7 日以上: グレー「保存期間: あと N 日」
 * - しおりなし + 残り 7 日未満: オレンジ「⚠️ あと N 日で削除されます」
 */
function RetentionBanner({
  bookmarked,
  sessionUpdatedAt,
  draftUpdatedAt,
  onToggleBookmark,
  loading,
}: {
  bookmarked: boolean
  sessionUpdatedAt: string | null
  draftUpdatedAt: string
  onToggleBookmark: () => void
  loading: boolean
}) {
  // 保持期間 = 30 日。session の updated_at と draft の updated_at の遅い方を起点にする
  // (どちらかが触られていれば「触っている」扱い、cron 側もこのロジックで判定する想定)
  const RETENTION_DAYS = 30
  const sessionTs = sessionUpdatedAt ? new Date(sessionUpdatedAt).getTime() : 0
  const draftTs = new Date(draftUpdatedAt).getTime()
  const lastTouchTs = Math.max(sessionTs, draftTs)
  const elapsedDays = Math.floor((Date.now() - lastTouchTs) / (24 * 60 * 60 * 1000))
  const remainingDays = Math.max(0, RETENTION_DAYS - elapsedDays)

  if (bookmarked) {
    return (
      <div className="px-3 py-1.5 bg-emerald-50/60 border-b border-emerald-100 text-[11px] text-emerald-700 flex items-center gap-2">
        <BookmarkCheck className="h-3.5 w-3.5 fill-emerald-500 text-emerald-600 shrink-0" />
        <span className="font-medium">しおりマーク (永続保存)</span>
        <span className="text-emerald-600/80">— このレポートとドラフトは保持期間で削除されません</span>
      </div>
    )
  }

  const tone =
    remainingDays >= 7
      ? 'bg-slate-50 border-slate-200 text-slate-600'
      : remainingDays >= 1
      ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-red-50 border-red-200 text-red-700'
  const message =
    remainingDays >= 7
      ? `保存期間: あと ${remainingDays} 日`
      : remainingDays >= 1
      ? `⚠️ あと ${remainingDays} 日で自動削除されます`
      : '⚠️ もうすぐ自動削除されます'

  return (
    <div className={`px-3 py-1.5 border-b text-[11px] flex items-center gap-2 ${tone}`}>
      <Bookmark className="h-3.5 w-3.5 shrink-0" />
      <span className="font-medium">{message}</span>
      <button
        type="button"
        onClick={onToggleBookmark}
        disabled={loading}
        className="ml-auto underline hover:no-underline disabled:opacity-50"
        title="しおりを付けて永続保存"
      >
        しおりで永続保存する
      </button>
    </div>
  )
}

/**
 * タイトルを 10 文字で切り詰め、超えたら ... を付ける。
 * (Gemini Canvas 風のシンプル表示用)
 */
function shortTitle(title: string | null | undefined, max = 10): string {
  const t = (title ?? '').trim() || 'レポート'
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/**
 * Canvas ヘッダーの統一アイコンボタン。
 * tone で見た目を切り替える: default / primary (青強調) / amber (しおり) / emerald (共有 ON)
 */
function IconButton({
  children,
  onClick,
  disabled,
  title,
  tone = 'default',
}: {
  children: React.ReactNode
  onClick?: () => void | Promise<void>
  disabled?: boolean
  title: string
  tone?: 'default' | 'primary' | 'amber' | 'emerald'
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-slate-800 text-white hover:bg-slate-900 border-slate-800'
      : tone === 'amber'
      ? 'text-amber-600 hover:bg-amber-50 border-transparent'
      : tone === 'emerald'
      ? 'text-emerald-700 bg-emerald-50/60 hover:bg-emerald-50 border-emerald-200'
      : 'text-slate-600 hover:bg-slate-100 border-transparent'
  // disabled な <button> はブラウザによって title (tooltip) が表示されないため、
  // <span title> でラップして tooltip を確実に表示させる
  return (
    <span title={title} className="inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
        className={`h-8 w-8 inline-flex items-center justify-center rounded-md border ${toneClass} transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {children}
      </button>
    </span>
  )
}

/**
 * 「その他」メニュー内に出す保持期間情報行。
 * しおり ON: 緑「永続保存中」
 * しおり OFF: グレー / amber「保存期間: あと N 日」(状態で色が変わる)
 */
function RetentionMenuItem({
  bookmarked,
  sessionUpdatedAt,
  draftUpdatedAt,
}: {
  bookmarked: boolean
  sessionUpdatedAt: string | null
  draftUpdatedAt: string
}) {
  const RETENTION_DAYS = 30
  const sessionTs = sessionUpdatedAt ? new Date(sessionUpdatedAt).getTime() : 0
  const draftTs = new Date(draftUpdatedAt).getTime()
  const lastTouchTs = Math.max(sessionTs, draftTs)
  const elapsedDays = Math.floor((Date.now() - lastTouchTs) / (24 * 60 * 60 * 1000))
  const remainingDays = Math.max(0, RETENTION_DAYS - elapsedDays)

  if (bookmarked) {
    return (
      <div className="px-3 py-2 text-[11px] text-emerald-700 bg-emerald-50/40 flex items-start gap-2">
        <BookmarkCheck className="h-3.5 w-3.5 fill-emerald-500 text-emerald-600 shrink-0 mt-px" />
        <span>
          <span className="font-medium">永続保存中</span>
          <br />
          <span className="text-emerald-600/80">しおりが付いているので自動削除されません</span>
        </span>
      </div>
    )
  }

  const tone =
    remainingDays >= 7
      ? 'text-slate-600 bg-slate-50'
      : remainingDays >= 1
      ? 'text-amber-700 bg-amber-50/60'
      : 'text-red-700 bg-red-50/60'

  return (
    <div className={`px-3 py-2 text-[11px] flex items-start gap-2 ${tone}`}>
      <Bookmark className="h-3.5 w-3.5 shrink-0 mt-px" />
      <span>
        <span className="font-medium">
          {remainingDays >= 1 ? `保存期間: あと ${remainingDays} 日` : 'まもなく自動削除'}
        </span>
        <br />
        <span className="opacity-80">しおりを付けると永続保存されます</span>
      </span>
    </div>
  )
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'generated':
      return '自動生成'
    case 'manual_edit':
      return '手動編集'
    case 'llm_edit':
      return 'AI 部分修正'
    default:
      return source
  }
}

/**
 * Canvas 上部のアニメーション付きステータス帯。
 * 「動いている感」を出すため:
 *  - 背景に左→右へ動く青グラデーション (animate-shimmer)
 *  - スピナー
 *  - 末尾の "..." を点滅
 * Tailwind の標準アニメーションだけでは shimmer が無いので、global.css に定義済みの
 * `animate-shimmer` を使う。後段で global.css にキーフレームを追加する。
 */
function CanvasStatusBar({
  phase,
  fallback,
  liveText,
}: {
  phase: 'idle' | 'drafting' | 'updating' | 'generating'
  /** phase=idle / 親が phase を渡してこなかった時の表示テキスト */
  fallback?: string
  /** SSE で来る生のステータステキスト。あればこれを最優先で表示 (固定文を上書き) */
  liveText?: string | null
}) {
  // liveText (= サーバーから流れてくる動的なステータス) が最優先。
  // 「ドラフトを更新中...」「レポートを再生成中...」などフェーズ遷移を反映するため。
  const text = liveText && liveText.trim().length > 0
    ? liveText
    : phase === 'generating'
      ? 'レポートを生成しています'
      : phase === 'updating'
      ? 'ドラフトを更新しています'
      : phase === 'drafting'
      ? 'ドラフトを作成しています'
      : fallback ?? 'ドラフトを作成しています'
  return (
    <div className="relative px-4 py-2.5 border-b shrink-0 overflow-hidden bg-blue-50/60">
      {/* 動くグラデーション (動いてる証拠アニメーション) */}
      <div
        className="absolute inset-0 opacity-70 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(96,165,250,0.18) 50%, transparent 100%)',
          animation: 'advisor-canvas-shimmer 1.6s linear infinite',
        }}
      />
      <div className="relative flex items-center gap-2 text-[12px] text-blue-900">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />
        <span className="font-medium">{text}</span>
        <AnimatedDots />
      </div>
      <style jsx>{`
        @keyframes advisor-canvas-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

/** 末尾の "..." が 1 つずつ点灯するシンプルなアニメ。文字色は親に従う。 */
function AnimatedDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="animate-pulse" style={{ animationDelay: '0ms' }}>.</span>
      <span className="animate-pulse" style={{ animationDelay: '150ms' }}>.</span>
      <span className="animate-pulse" style={{ animationDelay: '300ms' }}>.</span>
    </span>
  )
}

/**
 * レポート生成前のプレビュー (体裁確認用)。
 * - 見出しと 0 埋めの表で完成イメージを示す
 * - 実データではない旨を視覚的に伝えるため、表セルは text-slate-300 で薄く表示
 */
/**
 * Canvas のドラフト未確定時に表示するプレースホルダ。
 *
 * 以前は「セッション 0 / LP1〜LP3 / 仮説 1」のような架空の 0 埋めテーブル雛形を
 * 表示していたが、ユーザーから「これがレポートになるのかと誤解する」「Claude が
 * これを実体だと勘違いして仮説 1 を更新しに来る」というフィードバックがあったため、
 * **状態を伝える静かな空表示** に変更。実際のドラフト構造は Claude の
 * update_report_draft が書き込む skeleton_markdown が初めて現れる。
 */
function PreviewSkeleton(_props: { title?: string | null }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 px-4 py-8">
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <FileText className="h-8 w-8 text-slate-300" />
        <div className="text-sm text-slate-500">
          ドラフトを準備しています
        </div>
        <div className="text-xs text-slate-400 max-w-sm">
          チャットでレポートの要件 (期間・対象・データソース) を伝えると、ここに本文の骨格が表示されます。
        </div>
      </div>
    </div>
  )
}

/**
 * ドラフト本体ビュー (DB の skeleton_markdown を表示 + 手動編集)。
 *
 * - skeleton_markdown が空 → 固定の 0 埋め雛形 (PreviewSkeleton) を表示
 * - 「編集」ボタンで Markdown 直接編集モードに入り、保存で DB に書き戻す
 * - Claude が update_report_draft で書き換えた直後は親が再ロードして反映される (ポーリング)
 */
function DraftBodyView({
  title,
  skeletonMarkdown,
  sessionId,
  onSaved,
  editing,
  onEditingChange,
}: {
  title: string | null
  skeletonMarkdown: string | null
  sessionId: string
  onSaved?: (draft: ClientDraftSummary) => void
  /** 親 (ReportCanvas) が editing 状態を握る (ヘッダーの編集アイコン連動のため) */
  editing: boolean
  onEditingChange: (next: boolean) => void
}) {
  const [text, setText] = useState(skeletonMarkdown ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 外部更新 (Claude のツール呼び出し) を反映。編集中でなければ追従する。
  useEffect(() => {
    if (!editing) setText(skeletonMarkdown ?? '')
  }, [skeletonMarkdown, editing])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await updateDraftBulk({
      sessionId,
      skeletonMarkdown: text,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.reason ?? '保存に失敗しました')
      return
    }
    if (result.draft && onSaved) onSaved(result.draft)
    onEditingChange(false)
  }

  function handleCancel() {
    setText(skeletonMarkdown ?? '')
    onEditingChange(false)
    setError(null)
  }

  const md = skeletonMarkdown && skeletonMarkdown.trim().length > 0 ? skeletonMarkdown : null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          <Sparkles className="h-3 w-3" />
          レポートプレビュー (生成前)
        </span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ドラフト本体の Markdown (0 埋めの表骨格 + 章立て)"
            rows={Math.max(15, text.split('\n').length + 2)}
            className="w-full text-xs font-mono leading-relaxed border border-blue-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            autoFocus
            spellCheck={false}
          />
          {error && (
            <div className="text-[11px] text-red-600 flex items-start gap-1">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
              className="h-7 text-[11px] px-2"
            >
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-7 text-[11px] px-2 gap-1 bg-slate-800 hover:bg-slate-900 text-white"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              保存
            </Button>
          </div>
        </div>
      ) : md ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 px-3 py-3">
          <div className="prose prose-sm prose-neutral max-w-none [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h2]:font-semibold [&_h3]:font-medium [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_table]:text-xs [&_table]:my-2 [&_table]:border [&_table]:border-slate-200 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1 [&_th]:border [&_th]:border-slate-200 [&_th]:text-left [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-slate-200 [&_td]:text-slate-400">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{normalizeMarkdown(md)}</ReactMarkdown>
          </div>
        </div>
      ) : (
        // skeleton_markdown が未設定 → 固定の 0 埋め雛形を表示
        <PreviewSkeleton title={title} />
      )}
    </div>
  )
}

/**
 * フォーム 1 行のレイアウト共通化 (ラベル + 入力)。
 */
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
        {label}
      </div>
      {children}
    </div>
  )
}

