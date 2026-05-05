# [Antigravity 依頼 02] チャットUIから Custom Agent (CA) 関連機能を除去

## 目的

`_legacy_agent-hub/components/chat/` のチャットUIコンポーネントを TASTAS にコピーし、Custom Agent (CA) 機能・マルチエージェント機能・Canvas機能・通知機能を **完全に除去**する。

System Advisor は単一エージェント (Claude) のチャットなので、これらの機能はすべて不要。

## 背景

- legacy のチャットUIは Custom Agent / Shizue / Briefing などのマルチエージェントを前提に作られている
- これらをまとめて消し、シンプルなチャットUIに整理する
- Tailwind / shadcn の構造は活かす

## 作業手順

### Step 1: ファイルをコピー

```
_legacy_agent-hub/components/chat/chat-layout.tsx       → src/components/advisor/chat-layout.tsx
_legacy_agent-hub/components/chat/chat-input.tsx        → src/components/advisor/chat-input.tsx
_legacy_agent-hub/components/chat/chat-message.tsx      → src/components/advisor/chat-message.tsx
_legacy_agent-hub/components/chat/unified-message.tsx   → src/components/advisor/unified-message.tsx
_legacy_agent-hub/components/chat/thinking-indicator.tsx → src/components/advisor/thinking-indicator.tsx
_legacy_agent-hub/components/chat/status-indicator.tsx  → src/components/advisor/status-indicator.tsx
```

### Step 2: import パス修正 (全ファイル共通)

| 変更前 | 変更後 |
|-------|-------|
| `@/components/ui/button` | `@/components/ui/shadcn/button` |
| `@/components/ui/input` | `@/components/ui/shadcn/input` |
| `@/components/ui/textarea` | `@/components/ui/shadcn/textarea` |
| `@/components/ui/scroll-area` | `@/components/ui/shadcn/scroll-area` |
| `@/components/ui/dialog` | `@/components/ui/shadcn/dialog` |
| `@/components/ui/dropdown-menu` | `@/components/ui/shadcn/dropdown-menu` |
| `@/lib/utils` | `@/lib/cn` |
| `@/components/chat/...` | `@/components/advisor/...` |

### Step 3: chat-layout.tsx から削除する機能

以下の import / 機能を**完全に削除**:

#### 削除する import
```typescript
// すべて削除
import { CanvasPanel } from '@/components/canvas/canvas-panel'
import { getPinnedAgents, getCAConversations, deleteCAConversation, type CustomAgent, type CAConversationSummary } from '@/app/actions/custom-agents'
import { getAgentIcon, ICON_COLORS } from '@/lib/agent-icons'
import { approveAction } from '@/app/actions/pending-actions'
import { HubSwitcher } from '@/components/hub-switcher'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { PCStatusIndicator } from '@/components/openclaw/pc-status'
import { getSessionUser, signOut } from '@/app/actions/auth-actions'
```

#### 削除する変数・定数
```typescript
// AGENT_LABELS オブジェクト全体を削除
const AGENT_LABELS: Record<string, string> = { ... }
```

#### 削除する state / hook
- `caConversations` state
- `pinnedAgents` state
- `selectedAgent` state
- `canvasOpen` state
- `pendingActions` 関連 state
- `hubSwitcher` 関連
- `notification` 関連 state

#### 削除する JSX 要素
- `<CanvasPanel />` コンポーネント
- `<HubSwitcher />` コンポーネント
- `<NotificationBell />` コンポーネント
- `<PCStatusIndicator />` コンポーネント
- "📌 ピン留めエージェント" セクション
- "💬 通常のチャット" セクション (シンプルな1つのリストにまとめる)
- エージェントアイコン表示 (`getAgentIcon`)
- AGENT_LABELS を参照する部分

#### 残す/作り直す機能
- セッション一覧 (左サイドバー)
- 新規セッション作成ボタン
- メッセージ表示エリア
- 入力欄
- ストリーミング受信ロジック (ただし fetch URL は `/api/advisor/chat` に変更)

### Step 4: Server Action の参照を新規作成予定のものに置換

```typescript
// 変更前
import { getConversations, getConversationMessages, deleteConversation, type ConversationSummary } from '@/app/actions/conversations'

// 変更後 (これから作成するファイル)
import {
  getAdvisorSessions,
  getAdvisorMessages,
  deleteAdvisorSession,
  type AdvisorSessionSummary,
} from '@/lib/advisor/actions'
```

実際のサーバーアクションは Phase 3 で Claude Code (本AI) が作成する。
Antigravity 側ではこの import 文だけ置換し、関数の使い方は legacy のロジックを踏襲する。

### Step 5: chat-input.tsx の簡略化

#### 削除する機能
- ファイル添付 (画像・動画・PDF)
- モデル選択ドロップダウン (Sonnet 固定にする)
- 保存プロンプト機能
- ツールピッカー (Image / Video / Web fetch / PC ops)
- 音声入力

#### 残す機能
- テキスト入力欄 (textarea)
- 送信ボタン
- Enter キーでの送信 (Shift+Enter で改行)
- 送信中の disabled 状態

### Step 6: unified-message.tsx の簡略化

#### 残す機能
- markdown レンダリング (簡易: 改行 + コードブロック程度で十分)
- メッセージ本文表示

#### 削除する機能
- choices (選択肢ボタン)
- images / videos の data URI 表示
- [SAVE_ACTION] タグの表示処理 (Phase 1 では使わないが、コードはコメントアウトで残す)

### Step 7: 認証・ユーザー情報の参照を削除

legacy の chat-layout は `getSessionUser` で Supabase Auth ユーザーを取得していたが、TASTAS では System Admin セッションは Server Component 側で確認済みのため、Client Component では不要。

該当する箇所をすべて削除。ユーザー名表示が必要なら props で受け取る形に変更。

## 完了条件

- [ ] `src/components/advisor/` に 6ファイルが配置されている
- [ ] 各ファイルの import が新しいパスを参照している
- [ ] CA / Shizue / Canvas / Notification 関連のコードが**完全に**削除されている (grep で `CustomAgent`, `Canvas`, `getAgentIcon`, `Shizue`, `notification` を検索してヒットしないこと)
- [ ] `npm run build` が成功する (型エラーが残る場合は、Server Action の不在によるもののみ許容。それ以外のエラーはすべて解消)

## 作業完了後チェックリスト (必須)

### 1. キャッシュクリアと再ビルド
```bash
rm -rf .next && npm run build
```
※ `actions` 関連の import エラーは想定内 (Phase 3 で Claude Code が作成予定)。それ以外のエラーは解消すること。

### 2. 不要参照のチェック
```bash
# 以下のキーワードが残っていないことを確認
grep -r "CustomAgent\|Shizue\|Canvas\|HubSwitcher\|getAgentIcon" src/components/advisor/
```
すべて空の結果になること。

### 3. ファイル変更一覧の報告
作業で追加・変更したファイル一覧を報告する。

### 4. 禁止事項の確認
- [ ] git push していない
- [ ] vercel deploy していない
- [ ] DB 操作 (prisma db push など) を実行していない
- [ ] `_legacy_agent-hub` 内のファイルを変更していない (コピー元として参照のみ)

## トラブルシューティング

### `Module not found: Can't resolve '@/lib/advisor/actions'`
→ 想定内のエラー。Phase 3 で Claude Code が `src/lib/advisor/actions.ts` を作成する。Antigravity の作業範囲ではない。

### CSS が崩れる
→ TASTAS は Tailwind v3 を使っており、shadcn は v3/v4 両対応。Phase 5 で Claude Code が確認するので、見た目の調整は不要。
