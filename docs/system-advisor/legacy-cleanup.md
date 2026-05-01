# `_legacy_agent-hub` クリーンアップ計画

## 1. 目的

`_legacy_agent-hub/` から System Advisor に必要な部品だけ抽出し、最終的にフォルダ全体を削除する。
不要部分を残すと容量・依存・誤参照のリスクがある。

## 2. 進め方 (3ステップ)

```
Step 1: 必要なものを src/ にコピー (Phase 5 で実施)
Step 2: コピー先で TASTAS 用に改修 (依存解決、認証連携、不要機能削除)
Step 3: _legacy_agent-hub/ フォルダごと削除
```

## 3. 抽出対象 (TASTAS にコピーするもの)

### 3.1 UIコンポーネント

| legacy パス | TASTAS コピー先 | 改修内容 |
|------------|----------------|---------|
| `components/chat/chat-layout.tsx` | `src/components/advisor/chat-layout.tsx` | CA関連削除、認証は iron-session 経由、Server Action 名変更 |
| `components/chat/chat-input.tsx` | `src/components/advisor/chat-input.tsx` | ファイル添付・モデル選択UI削除 (Phase 1 では Sonnet 固定) |
| `components/chat/chat-message.tsx` | `src/components/advisor/chat-message.tsx` | choices/canvas関連削除 |
| `components/chat/unified-message.tsx` | `src/components/advisor/unified-message.tsx` | [SAVE_ACTION] パターンは流用 (将来のツール承認用に温存) |
| `components/chat/thinking-indicator.tsx` | `src/components/advisor/thinking-indicator.tsx` | そのまま流用 |
| `components/chat/status-indicator.tsx` | `src/components/advisor/status-indicator.tsx` | そのまま流用 |

### 3.2 shadcn/ui コンポーネント

Advisor チャットで使用するもののみ:

| legacy パス | TASTAS コピー先 | 備考 |
|------------|----------------|------|
| `components/ui/button.tsx` | `src/components/ui/shadcn/button.tsx` | TASTAS 既存の Button.tsx と命名衝突回避 |
| `components/ui/input.tsx` | `src/components/ui/shadcn/input.tsx` | 同上 |
| `components/ui/textarea.tsx` | `src/components/ui/shadcn/textarea.tsx` | |
| `components/ui/scroll-area.tsx` | `src/components/ui/shadcn/scroll-area.tsx` | @radix-ui/react-scroll-area 依存 |
| `components/ui/dialog.tsx` | `src/components/ui/shadcn/dialog.tsx` | セッション削除確認等で使用 |
| `components/ui/dropdown-menu.tsx` | `src/components/ui/shadcn/dropdown-menu.tsx` | |
| `lib/utils.ts` (cn helper) | `src/lib/cn.ts` | 既存ユーティリティと衝突回避のため改名 |

**スキップするもの**: avatar / badge / label / separator / sheet / tabs (Phase 1 では未使用)

### 3.3 LLM / バックエンド

| legacy パス | TASTAS コピー先 | 改修内容 |
|------------|----------------|---------|
| `lib/claude.ts` | `src/lib/advisor/claude.ts` | そのまま流用 (Anthropic SDK ラッパー) |
| `lib/llm/prompt-cache.ts` | `src/lib/advisor/prompt-cache.ts` | feature-flags 依存削除、シンプル化 |
| `lib/models.ts` | `src/lib/advisor/models.ts` | Sonnet/Haiku のみに整理、Gemini 削除 |
| `lib/llm-stream.ts` | (流用しない) | TASTAS 用に新規実装。Anthropic SDK の `messages.stream()` を直接使う方が tools 対応が楽 |

### 3.4 必要な npm 依存追加

```json
// TASTAS の package.json に追加
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.85.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "@radix-ui/react-scroll-area": "^1.2.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0"
  }
}
```

## 4. 削除対象 (legacy 全体)

### 4.1 完全に不要 (削除確定)

#### app/ 配下
- `app/agents/` — Custom Agent (CA) 機能。Advisor は単一エージェントなので不要
- `app/app-hub/` — マルチエージェントハブ。不要
- `app/shared/` — guest向け共有チャット。不要
- `app/shizue/` — Shizue 専用エージェント。不要
- `app/history/` — CA履歴。不要
- `app/schedule/` — Google Calendar連携。不要
- `app/notifications/` — 通知UI。不要
- `app/rules/` — エージェントルール設定。不要
- `app/settings/` — 全設定UI。不要
- `app/login/`, `app/auth/` — Supabase Auth関連。TASTAS は別認証なので不要
- `app/page.tsx`, `app/layout.tsx` — TASTAS 側で構築

#### app/api/ 配下
- `app/api/ca-chat/` — CA chat。Advisor は別実装
- `app/api/ca-tasks/`, `app/api/ca-knowledge/` — CA関連
- `app/api/source-view/` — CA設定UI関連
- `app/api/specs/` — Shizue仕様
- `app/api/cdp-sites/` — Shizue CDP連携
- `app/api/line-webhook/`, `app/api/line/` — LINE Bot機能
- `app/api/briefing/` — Briefing agent
- `app/api/schedule/` — スケジュール連携
- `app/api/openclaw/` — OpenClaw (画面操作agent)
- `app/api/member/` — メンバー管理
- `app/api/testing/` — テストrunner
- `app/api/shizue/` — Shizueエンドポイント
- `app/api/events/` — イベント基盤
- `app/api/cron/` — Shizue/CA向けcron。Advisor用は新規実装
- `app/api/media/` — 画像編集API

#### app/api/chat/ — 流用するか?
- ベースとして読むのは有益だが、CA関連の認証・コンテキスト構築が混在
- → **流用しない。Advisor 用に新規実装**するほうが綺麗 (300行程度)

#### lib/ 配下 (大半が CA / Shizue / マルチエージェント関連)
- `lib/agents/` — 削除
- `lib/ambient/` — 削除
- `lib/cdp/` — 削除
- `lib/channel-adapters/` — 削除
- `lib/events/` — 削除
- `lib/feature-flags/` — 削除 (TASTAS では不要)
- `lib/llm/langfuse-wrapper.ts` — 削除 (Phase 1 では不要、コスト監視は自前)
- `lib/llm/model-router.ts` — 削除 (Sonnet 固定)
- `lib/llm/semantic-cache.ts` — 削除 (使わない)
- `lib/mcp/` — 削除 (Phase 外で MCP 検討)
- `lib/memory/` — 削除 (DB ベースで自前実装)
- `lib/openclaw/` — 削除
- `lib/schedule/` — 削除
- `lib/shizue/` — 削除
- `lib/testing/` — 削除
- `lib/tools/` — 削除 (Advisor 用に新規ツール定義)
- `lib/agent-icons.tsx` — 削除
- `lib/auth.ts` — 削除 (Supabase Auth前提なので使わない)
- `lib/capabilities.ts`, `lib/permissions.ts` — 削除 (CA向け、Advisor は単一)
- `lib/encryption.ts` — 削除
- `lib/gemini-knowledge.ts` — 削除
- `lib/google-auth.ts`, `lib/guest-oauth.ts` — 削除
- `lib/infra-usage.ts`, `lib/llm-usage.ts` — 削除 (自前で `AdvisorUsageDaily`)
- `lib/multi-agent.ts` — 削除
- `lib/specs.ts` — 削除
- `lib/common-prompt.ts` — 削除 (新規 system-prompt.ts)

#### components/ 配下
- `components/agents/` — 削除
- `components/canvas/` — 削除 (Canvas機能は Phase 外)
- `components/notifications/` — 削除
- `components/openclaw/` — 削除
- `components/settings/` — 削除
- `components/test-notification.tsx` — 削除
- `components/hub-switcher.tsx` — 削除

#### supabase/ 配下
- `supabase/migrations/` — 削除 (TASTAS の prisma で別途管理)

#### その他のルートファイル
- `AGENTS.md`, `CLAUDE.md` (ほぼ空), `README.md`, `TEST_CHECKLIST.md` — 削除
- `CUSTOM_AGENT_DESIGN.md` — 削除
- `next.config.ts`, `tsconfig.json`, `vercel.json`, `eslint.config.mjs` — 削除 (TASTAS のものを使う)
- `instrumentation*.ts`, `sentry.*.config.ts` — 削除 (TASTAS で別途設定)
- `middleware.ts` — 削除 (TASTAS の認証とは別)
- `package.json`, `package-lock.json` — 削除
- `node_modules/` — 削除 (約 994MB の節約!)
- `.next/`, `.vercel/`, `.git/` — 削除
- `tsconfig.tsbuildinfo` — 削除
- `eval/`, `scripts/`, `utils/` — 削除

### 4.2 最終的な完全削除

3つのコピー作業 (UI / shadcn / lib/claude等) が完了し、TASTAS 側のビルドが通った後:

```bash
# 1. legacy フォルダ全体を削除
rm -rf _legacy_agent-hub

# 2. .gitignore から関連エントリを削除 (もしあれば)
```

## 5. Antigravity 向け委託タスク (依頼書ドラフト)

`docs/system-advisor/antigravity-tasks/` 配下に依頼書を配置する。

### Antigravity 委託作業1: shadcn UI ファイルのコピー&改修

→ `antigravity-tasks/01-shadcn-ui-copy.md` (本ドキュメントの後に作成)

### Antigravity 委託作業2: legacy chat UI から CA関連機能の除去

→ `antigravity-tasks/02-chat-ui-strip-ca.md` (本ドキュメントの後に作成)

これらは Phase 5 (UI実装) のタイミングで Antigravity に依頼する。

## 6. クリーンアップ実施タイミング

| ステップ | タイミング | 担当 |
|---------|----------|------|
| 必要部品のコピー | Phase 5 (UI実装) 開始時 | Claude Code (本AI) |
| TASTAS 用改修 | Phase 5 中 | Claude Code |
| 単純な抽出作業 | Phase 5 中 | Antigravity (依頼書経由) |
| ビルド確認 | Phase 6 | Claude Code |
| **legacy フォルダ削除** | Phase 6 完了後 | **ユーザー (kawashima) が確認後実行** |

最終削除はユーザーが実行する (誤って必要なものを消さないよう、最後に1段確認を挟む)。

## 7. 削除前の最終確認チェックリスト

```
□ TASTAS の npm run build が成功する
□ TASTAS の npm run lint がエラーなし
□ /system-admin/advisor が正常表示される
□ チャット送信→ストリーミング応答が動く
□ 各種ツール (read_repo_file, query_metric 等) が動作する
□ src/components/advisor/ , src/lib/advisor/ , src/components/ui/shadcn/ に
  必要なファイルが揃っている (legacy を見ずに動く)
□ git status で _legacy_agent-hub 以外の意図しない変更がない
```

すべて ✓ になったら `rm -rf _legacy_agent-hub` を実行する。
