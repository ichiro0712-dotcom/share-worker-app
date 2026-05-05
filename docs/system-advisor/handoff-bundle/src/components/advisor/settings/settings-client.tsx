'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Bot,
  Database,
  Github,
  LineChart,
  ServerCog,
  CheckCircle2,
  CircleAlert,
  CircleSlash,
  Save,
  Sliders,
} from 'lucide-react'
import { Button } from '@/src/components/ui/shadcn/button'
import { Input } from '@/src/components/ui/shadcn/input'
import { Textarea } from '@/src/components/ui/shadcn/textarea'
import { saveSettings } from '@/src/lib/advisor/actions/settings'
import type {
  DataSourceInfo,
  ToolStatusInfo,
  MonthlyUsageRow,
} from '@/src/lib/advisor/actions/settings'
import type { AdvisorSettingsValues } from '@/src/lib/advisor/persistence/settings'

interface Props {
  initialSettings: AdvisorSettingsValues
  defaultPromptText: string
  dataSources: DataSourceInfo[]
  tools: ToolStatusInfo[]
  monthlyUsage: MonthlyUsageRow[]
}

type SectionId = 'basic' | 'data'

export function SettingsClient({
  initialSettings,
  defaultPromptText,
  dataSources,
  tools,
  monthlyUsage,
}: Props) {
  const [section, setSection] = useState<SectionId>('basic')

  return (
    <div className="flex h-screen bg-slate-50">
      {/* 左: 設定ページ専用サイドバー */}
      <aside className="w-60 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200">
          <Link
            href="/system-admin/advisor"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            アドバイザーに戻る
          </Link>
          <div className="flex items-center gap-2 mt-3">
            <div className="h-7 w-7 rounded-lg bg-slate-800 text-white flex items-center justify-center">
              <SettingsIcon className="h-4 w-4" />
            </div>
            <h1 className="text-sm font-semibold text-slate-800">
              アドバイザー設定
            </h1>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <SidebarItem
            active={section === 'basic'}
            onClick={() => setSection('basic')}
            icon={Sliders}
            label="基本設定"
            sub="使用統計・ラリー回数・プロンプト"
          />
          <SidebarItem
            active={section === 'data'}
            onClick={() => setSection('data')}
            icon={Database}
            label="Data ソース"
            sub="参照可能データ・ツール一覧"
          />
        </nav>
      </aside>

      {/* 右: メインコンテンツ */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-8 px-6">
          {section === 'basic' && (
            <BasicSection
              initialSettings={initialSettings}
              defaultPromptText={defaultPromptText}
              monthlyUsage={monthlyUsage}
            />
          )}
          {section === 'data' && (
            <DataSourcesSection dataSources={dataSources} tools={tools} />
          )}
        </div>
      </main>
    </div>
  )
}

// =====================================================================
// サイドバー: nav item
// =====================================================================

function SidebarItem({
  active,
  onClick,
  icon: Icon,
  label,
  sub,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  sub?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-md text-left transition-colors ${
        active
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon
        className={`h-4 w-4 mt-0.5 shrink-0 ${active ? 'text-slate-800' : 'text-slate-400'}`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </button>
  )
}

// =====================================================================
// セクション: 基本設定 (LLM 使用統計 / ラリー回数 / プロンプト)
// =====================================================================

// 設定 UI のモデル選択肢。code default の意味で空文字も許す。
// 公式推奨は alias 利用 (snapshot ピン留めは deprecation/retirement のリスクが高い)。
const MODEL_OPTIONS: Array<{ value: string; label: string; note?: string }> = [
  { value: '', label: 'コードのデフォルト (Sonnet 4 — claude-sonnet-4-20250514)', note: '⚠️ 2026-06-15 retire 予定' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (claude-sonnet-4-6 alias)', note: '推奨 / Sonnet 4 の公式後継' },
  { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5 (claude-sonnet-4-5 alias)' },
  { value: 'claude-opus-4-7', label: 'Opus 4.7 (高精度・高コスト)' },
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5 (高速・低コスト)' },
]

function BasicSection({
  initialSettings,
  defaultPromptText,
  monthlyUsage,
}: {
  initialSettings: AdvisorSettingsValues
  defaultPromptText: string
  monthlyUsage: MonthlyUsageRow[]
}) {
  const [maxToolLoops, setMaxToolLoops] = useState<number>(
    initialSettings.maxToolLoops
  )
  // 初期値: 保存済み override があればそれ、無ければコード内デフォルト。
  // 「常に今動いているプロンプト」が見える状態にする。
  const [promptText, setPromptText] = useState<string>(
    initialSettings.systemPromptOverride ?? defaultPromptText
  )
  // モデル選択。空文字は「DB 値 null = コードデフォルト使用」を意味する
  const [primaryModel, setPrimaryModel] = useState<string>(
    initialSettings.primaryModelId ?? ''
  )
  const [loop1Model, setLoop1Model] = useState<string>(
    initialSettings.loop1ModelId ?? ''
  )
  const [saving, startSaving] = useTransition()
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function handleSave() {
    setErrorMsg(null)
    startSaving(async () => {
      // デフォルトと完全一致するなら DB には null で保存
      // (将来コード側のデフォルトが変わった時、自動で追従させるため)
      const trimmed = promptText.trim()
      const override =
        trimmed === '' || trimmed === defaultPromptText.trim() ? null : promptText
      const r = await saveSettings({
        maxToolLoops,
        systemPromptOverride: override,
        primaryModelId: primaryModel === '' ? null : primaryModel,
        loop1ModelId: loop1Model === '' ? null : loop1Model,
      })
      if (r.ok) {
        setSavedAt(new Date())
      } else {
        setErrorMsg(r.error)
      }
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">基本設定</h2>
        <p className="text-sm text-slate-500 mt-2">
          ツール呼び出し上限・システムプロンプト・月次使用統計
        </p>
      </div>

      {/* LLM 使用統計 (直近 12ヶ月) */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <LineChart className="h-4 w-4" />
            LLM 使用統計 (直近 12 ヶ月)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            注: 現状はモデル別 (Sonnet/Opus/Haiku) の内訳は出ません (将来課題)
          </p>
        </div>

        {monthlyUsage.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">
            まだ使用記録がありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-left py-2 px-2 font-medium">月</th>
                  <th className="text-right py-2 px-2 font-medium">入力</th>
                  <th className="text-right py-2 px-2 font-medium">出力</th>
                  <th className="text-right py-2 px-2 font-medium">
                    キャッシュ読
                  </th>
                  <th className="text-right py-2 px-2 font-medium">
                    キャッシュ書
                  </th>
                  <th className="text-right py-2 px-2 font-medium">
                    合計トークン
                  </th>
                  <th className="text-right py-2 px-2 font-medium">
                    メッセージ
                  </th>
                  <th className="text-right py-2 px-2 font-medium">ツール</th>
                  <th className="text-right py-2 px-2 font-medium">USD</th>
                </tr>
              </thead>
              <tbody>
                {monthlyUsage.map((row) => (
                  <tr key={row.month} className="border-b border-slate-100">
                    <td className="py-2 px-2 text-slate-700">{row.month}</td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      {row.inputTokens.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      {row.outputTokens.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums text-slate-500">
                      {row.cacheReadTokens.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums text-slate-500">
                      {row.cacheWriteTokens.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums font-medium">
                      {row.totalTokens.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      {row.messageCount.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      {row.toolCallCount.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      ${row.estimatedCostUsd.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ラリー回数 + プロンプト編集 */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <ServerCog className="h-4 w-4" />
            動作パラメータ
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            次回のチャット応答から反映されます (永続保存)
          </p>
        </div>

        {/* ラリー回数 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            ツール呼び出し上限 (ラリー回数)
          </label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={100}
              value={maxToolLoops}
              onChange={(e) => setMaxToolLoops(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-xs text-slate-500">
              1〜100。Advisor が連続でツールを呼び出せる回数。多くの調査を許す代わりにコストが増える。デフォルト:
              20
            </span>
          </div>
        </div>

        {/* モデル選択 (primary) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            メインモデル (loop=0 = ユーザー応答 / ツール呼び出し)
          </label>
          <select
            value={primaryModel}
            onChange={(e) => setPrimaryModel(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value || 'default'} value={opt.value}>
                {opt.label}
                {opt.note ? `   ${opt.note}` : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            ⚠️ Sonnet 4 は 2026-06-15 で retire 予定。Sonnet 4.6 への切替を推奨。
            空 (デフォルト) のままだと code 内 ADVISOR_MODELS.sonnet が使われます。
          </p>
        </div>

        {/* モデル選択 (loop>0) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            ツール実行後モデル (loop&gt;0 = ツール後の最終応答用)
          </label>
          <select
            value={loop1Model}
            onChange={(e) => setLoop1Model(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">メインモデルと同じ</option>
            {MODEL_OPTIONS.filter((o) => o.value !== '').map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
                {opt.note ? `   ${opt.note}` : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            ツール実行後の差分説明 (1〜2 行) だけ別モデルにする運用用。
            Haiku 4.5 を選ぶと TTFB の改善が期待できる (Sonnet 4 のキュー混雑を回避)。
            空 (デフォルト) ならメインモデルと同じ。
          </p>
        </div>

        {/* プロンプト編集 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            システムプロンプト
          </label>
          <p className="text-xs text-slate-500">
            現在 Advisor が使っているプロンプト本文。書き換えて「保存」を押すと、次回のチャットから反映されます。
            知識ブロック (CLAUDE.md / schema.prisma 等) は別途自動注入されるので含める必要はありません。
          </p>
          <Textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            className="min-h-[400px] font-mono text-xs"
            maxLength={50000}
          />
          <div className="text-xs text-slate-400 text-right">
            {promptText.length.toLocaleString()} / 50,000 文字
          </div>
        </div>

        {/* 保存ボタン + 状態 */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            {savedAt && (
              <span className="text-green-600">
                ✅ 保存しました ({savedAt.toLocaleTimeString('ja-JP')})
              </span>
            )}
            {errorMsg && <span className="text-red-500">❌ {errorMsg}</span>}
            {!savedAt && !errorMsg && initialSettings.updatedAt && (
              <span>
                最終更新:{' '}
                {new Date(initialSettings.updatedAt).toLocaleString('ja-JP')}
                {initialSettings.updatedByAdminId
                  ? ` (admin id: ${initialSettings.updatedByAdminId})`
                  : ''}
              </span>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="gap-1.5 bg-slate-800 hover:bg-slate-900 text-white"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </section>
    </div>
  )
}

// =====================================================================
// セクション 3: Data ソース
// =====================================================================

function DataSourcesSection({
  dataSources,
  tools,
}: {
  dataSources: DataSourceInfo[]
  tools: ToolStatusInfo[]
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Data ソース</h2>
        <p className="text-sm text-slate-500 mt-2">
          Advisor が現在アクセスできる外部システム一覧 (表示のみ)
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Database className="h-4 w-4" />
          外部接続
        </h3>
        <div className="space-y-2">
          {dataSources.map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-3 p-3 border border-slate-200 rounded-md"
            >
              <CategoryIcon category={s.category} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    {s.label}
                  </span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs text-slate-500 mt-1">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Bot className="h-4 w-4" />
          ツール一覧 ({tools.filter((t) => t.ready).length} / {tools.length})
        </h3>
        <div className="space-y-1 text-xs">
          {tools.map((t) => (
            <div
              key={t.name}
              className="flex items-start gap-2 p-2 border border-slate-100 rounded"
            >
              {t.ready ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <CircleSlash className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <code className="text-slate-800">{t.name}</code>
                <span className="text-slate-400 ml-2">({t.category})</span>
                <p className="text-slate-500 mt-0.5">{t.description}</p>
                {!t.ready && t.reason && (
                  <p className="text-amber-600 mt-0.5">⚠️ {t.reason}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// =====================================================================
// 共通: アイコン / バッジ
// =====================================================================

function CategoryIcon({ category }: { category: DataSourceInfo['category'] }) {
  const Icon =
    category === 'github'
      ? Github
      : category === 'database'
        ? Database
        : category === 'analytics'
          ? LineChart
          : category === 'logs'
            ? ServerCog
            : Bot
  return <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
}

function StatusBadge({ status }: { status: DataSourceInfo['status'] }) {
  if (status === 'ready') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> 接続中
      </span>
    )
  }
  if (status === 'fallback') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
        <CircleAlert className="h-3 w-3" /> フォールバック
      </span>
    )
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 inline-flex items-center gap-1">
      <CircleSlash className="h-3 w-3" /> 未設定
    </span>
  )
}
