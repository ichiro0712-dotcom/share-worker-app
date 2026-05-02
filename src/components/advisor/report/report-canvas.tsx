'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, FileText, RefreshCw, Trash2, Sparkles, Copy, Check, AlertCircle, X, Send, Pencil, ChevronDown, History } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  type ClientVersionSummary,
  type ClientVersionDetail,
} from '@/src/lib/advisor/actions/report-versions'

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
}: ReportCanvasProps) {
  const [draft, setDraft] = useState<ClientDraftSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<'draft' | 'result'>('draft')
  const [notifying, setNotifying] = useState(false)
  const [notifyState, setNotifyState] = useState<'idle' | 'sent' | 'error'>('idle')
  const [notifyError, setNotifyError] = useState<string | null>(null)
  // P1-3 / P1-9: バージョン管理
  const [versions, setVersions] = useState<ClientVersionSummary[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [activeVersion, setActiveVersion] = useState<ClientVersionDetail | null>(null)
  const [versionMenuOpen, setVersionMenuOpen] = useState(false)
  // P1-9: 手動編集モード
  const [editing, setEditing] = useState(false)
  const [editingText, setEditingText] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
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
  const pollRef = useRef<number | null>(null)
  const generateAbortRef = useRef<AbortController | null>(null)

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

    // active version の選定: 既選択があり一覧にも残っていればそのまま、無ければ最新 (vs[0])
    const stillExists = vs.find((v) => v.id === activeVersionId)
    const next = stillExists ?? vs[0] ?? null
    if (next?.id !== activeVersionId) {
      setActiveVersionId(next?.id ?? null)
    }

    // 結果がある状態でドラフトが新しく更新されたら、ユーザーが Canvas を見ている時の表示は draft に戻す
    // ただし完了直後 (generating だった→completed) は result を表示
    if (d?.status === 'completed' && d.resultMarkdown && view === 'draft' && generating) {
      setView('result')
    }
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

  useEffect(() => {
    setLoading(true)
    reload().finally(() => setLoading(false))
    // ポーリング (2秒間隔)
    pollRef.current = window.setInterval(reload, 2000)
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [reload])

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

  async function handleNotifyGoogleChat() {
    if (!sessionId) return
    setNotifying(true)
    setNotifyError(null)
    setNotifyState('idle')
    try {
      const res = await fetch('/api/advisor/report/notify-gchat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const json = (await res.json()) as { ok: true } | { ok: false; error: string }
      if (!res.ok || !json.ok) {
        const msg = !json.ok ? json.error : 'Google Chat への送信に失敗しました'
        setNotifyError(msg)
        setNotifyState('error')
        setTimeout(() => setNotifyState('idle'), 4000)
      } else {
        setNotifyState('sent')
        setTimeout(() => setNotifyState('idle'), 2000)
      }
    } catch (e) {
      setNotifyError(e instanceof Error ? e.message : String(e))
      setNotifyState('error')
      setTimeout(() => setNotifyState('idle'), 4000)
    } finally {
      setNotifying(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-slate-700 shrink-0" />
            <span className="text-sm font-semibold text-slate-800 truncate">レポートプレビュー</span>
          </div>
        </div>
        <CanvasStatusBar phase={chatPhase} fallback="ドラフトを作成しています" />
        <ScrollArea className="flex-1">
          <PreviewSkeleton />
        </ScrollArea>
      </div>
    )
  }

  if (loading && !draft) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-slate-700 shrink-0" />
            <span className="text-sm font-semibold text-slate-800 truncate">レポートプレビュー</span>
          </div>
        </div>
        <CanvasStatusBar phase={chatPhase} fallback="ドラフトを作成しています" />
        <ScrollArea className="flex-1">
          <PreviewSkeleton />
        </ScrollArea>
      </div>
    )
  }

  if (!draft) {
    // ドラフト未作成 (= 「レポート作成」ツールを選んだ直後 等)
    // → 最終レポートの体裁が分かるようにプレースホルダ (見出し + 0 埋めの表) を表示
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-slate-700 shrink-0" />
            <span className="text-sm font-semibold text-slate-800 truncate">レポートプレビュー</span>
          </div>
          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700"
              title="閉じる"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <CanvasStatusBar phase={chatPhase} fallback="ドラフトを作成しています" />
        <ScrollArea className="flex-1">
          <PreviewSkeleton />
        </ScrollArea>
      </div>
    )
  }

  const canGenerate = draft.dataSources.length > 0 && draft.status !== 'generating'
  const hasResult = !!draft.resultMarkdown

  // ドラフト編集中 / 生成中 / アイドルを動的に判定して Canvas 上部のアニメーション帯に渡す。
  // - 生成中 (draft.status === 'generating' or generating state) は最優先
  // - チャット側の chatPhase で「ドラフト作成中」「ドラフト更新中」をハイライト
  const liveStatus: 'generating' | 'drafting' | 'updating' | 'idle' =
    draft.status === 'generating' || generating
      ? 'generating'
      : chatPhase === 'drafting'
      ? 'drafting'
      : chatPhase === 'updating'
      ? 'updating'
      : 'idle'

  return (
    <div className="h-full flex flex-col bg-white">
      {/* ヘッダー */}
      <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-slate-700 shrink-0" />
          <span className="text-sm font-semibold text-slate-800 truncate">
            {draft.title || 'レポートドラフト'}
          </span>
          {/* ドラフトであることを示す赤バッジ。タイトル直後に固定表示。 */}
          <span
            className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold tracking-wider uppercase border border-red-200"
            title="このレポートは確定版ではなくドラフトです"
          >
            ドラフト
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={reload}
            disabled={loading}
            className="h-7 w-7 p-0"
            title="再読み込み"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
            className="h-7 w-7 p-0 text-slate-500 hover:text-red-600"
            title="ドラフトを削除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 進行中アニメーション帯 (動いてる時だけ表示) */}
      {liveStatus !== 'idle' && (
        <CanvasStatusBar
          phase={
            liveStatus === 'generating'
              ? 'generating'
              : liveStatus === 'updating'
              ? 'updating'
              : 'drafting'
          }
        />
      )}

      {/* タブ (結果がある場合のみ表示) */}
      {hasResult && (
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setView('draft')}
            className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              view === 'draft'
                ? 'border-slate-800 text-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            ドラフト
          </button>
          <button
            onClick={() => setView('result')}
            className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              view === 'result'
                ? 'border-slate-800 text-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            レポート (v{activeVersion?.versionNumber ?? draft.generationCount})
          </button>
        </div>
      )}

      {/* P1-3: バージョン切替ドロップダウン (結果ビュー & 複数バージョンがある時のみ) */}
      {view === 'result' && hasResult && versions.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-slate-50/50 shrink-0">
          <History className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setVersionMenuOpen(!versionMenuOpen)}
              className="w-full text-left flex items-center justify-between gap-2 px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-50"
            >
              <span className="truncate">
                {activeVersion ? formatVersionLabel(activeVersion) : 'バージョン選択'}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-500 shrink-0" />
            </button>
            {versionMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setVersionMenuOpen(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
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
        </div>
      )}

      {/* コンテンツ */}
      <ScrollArea className="flex-1">
        {view === 'draft' || !hasResult ? (
          <div className="p-4 space-y-4 text-sm">
            {/* レポート本体ドラフト (Claude が書き換える skeleton_markdown を表示)。
                値が無ければ固定の 0 埋め雛形を表示する。 */}
            {!hasResult && (
              <DraftBodyView
                title={draft.title}
                skeletonMarkdown={draft.skeletonMarkdown}
                sessionId={sessionId}
                onSaved={(d) => setDraft(d)}
              />
            )}

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
                <FormRow label="取得する指標 (query_metric)">
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

            {/* 生成中 / エラー表示 */}
            {(draft.status === 'generating' || generating) && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="flex-1">Gemini にレポート生成を依頼中...</span>
                {generating && generateAbortRef.current && (
                  <button
                    onClick={handleCancelGenerate}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-blue-700 hover:text-red-600 hover:bg-white border border-blue-200"
                    title="生成を中止"
                  >
                    <X className="h-3 w-3" />
                    中止
                  </button>
                )}
              </div>
            )}
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayMarkdown ?? ''}</ReactMarkdown>
            </div>
            {notifyError && notifyState === 'error' && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                <span className="min-w-0 break-words">{notifyError}</span>
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

      {/* フッター: レポート作成ボタン */}
      <div className="border-t bg-slate-50 px-3 py-2.5 shrink-0 flex items-center gap-2 flex-wrap">
        {view === 'result' && hasResult && editing ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelEdit}
              disabled={savingEdit}
              className="h-8 text-xs gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="h-8 text-xs gap-1.5 ml-auto bg-slate-800 hover:bg-slate-900 text-white"
            >
              {savingEdit ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {savingEdit ? '保存中...' : '保存 (新バージョン)'}
            </Button>
          </>
        ) : view === 'result' && hasResult ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="h-8 text-xs gap-1.5"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'コピー済み' : 'コピー'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleStartEdit}
              disabled={!activeVersion || activeVersion.lockedByOther}
              className="h-8 text-xs gap-1.5"
              title={
                activeVersion?.lockedByOther
                  ? '別の管理者が編集中です'
                  : 'このバージョンを直接編集 (保存で新バージョン)'
              }
            >
              <Pencil className="h-3.5 w-3.5" />
              編集
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNotifyGoogleChat}
              disabled={notifying}
              className="h-8 text-xs gap-1.5"
              title="Google Chat に送信"
            >
              {notifyState === 'sent' ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : notifyState === 'error' ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-600" />
              ) : notifying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {notifyState === 'sent'
                ? '送信済み'
                : notifyState === 'error'
                ? '失敗'
                : notifying
                ? '送信中...'
                : 'Chat に送信'}
            </Button>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              className="h-8 text-xs gap-1.5 ml-auto bg-slate-800 hover:bg-slate-900 text-white"
              title="現在のドラフト要件で本文を作り直す"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              レポート作成
            </Button>
          </>
        ) : generating ? (
          <Button
            size="sm"
            onClick={handleCancelGenerate}
            variant="outline"
            className="h-8 w-full text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            生成中... (クリックで中止)
          </Button>
        ) : (
          // ドラフト段階のフッター: 上に「ドラフト更新」、下に「レポート作成」
          <div className="flex flex-col gap-2 w-full">
            <Button
              size="sm"
              onClick={handleSaveDraft}
              disabled={savingDraft || draftEdit === null}
              variant="outline"
              className="h-8 w-full text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              title={draftEdit === null ? '変更がありません' : 'ドラフト要件を保存します (本文は生成しません)'}
            >
              {savingDraft ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : savedFlash && draftEdit === null ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
              {savingDraft ? '保存中...' : 'ドラフト更新'}
            </Button>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="h-8 w-full text-xs gap-1.5 bg-slate-800 hover:bg-slate-900 text-white disabled:bg-slate-300"
              title="データを取得して本文 (数値・表・コメント) を生成"
            >
              <Sparkles className="h-3.5 w-3.5" />
              レポート作成 (本文生成)
            </Button>
          </div>
        )}
      </div>
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
}: {
  phase: 'idle' | 'drafting' | 'updating' | 'generating'
  /** phase=idle / 親が phase を渡してこなかった時の表示テキスト */
  fallback?: string
}) {
  const text =
    phase === 'generating'
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
}: {
  title: string | null
  skeletonMarkdown: string | null
  sessionId: string
  onSaved?: (draft: ClientDraftSummary) => void
}) {
  const [editing, setEditing] = useState(false)
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
    setEditing(false)
  }

  function handleCancel() {
    setText(skeletonMarkdown ?? '')
    setEditing(false)
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
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[10px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
            title="ドラフト本体を直接編集"
          >
            <Pencil className="h-3 w-3" />
            手動編集
          </button>
        )}
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
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

