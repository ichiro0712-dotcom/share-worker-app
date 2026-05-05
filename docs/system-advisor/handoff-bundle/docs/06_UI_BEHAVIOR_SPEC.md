# 06. UI 完全マッピング (粒度最大)

**作成日**: 2026-05-04
**目的**: hub-platform 側で TASTAS Advisor の **ボタン / 文字 / 色 / 状態遷移を完全再現**できるようにする
**正本**: 実コード (`src/components/advisor/`)。本ドキュメントとコードに齟齬があれば**コードを正**とすること
**設計言語**: Tailwind CSS (色は Tailwind スケール `slate-*` `red-*` `amber-*` `emerald-*` `blue-*` で表記)

---

## 0. 共通スタイル

### 0.1 全画面共通の色パレット

| 用途 | Tailwind class |
|---|---|
| 背景 (アプリ外周) | `bg-slate-100` |
| カード背景 | `bg-white` |
| カード枠 | `border border-slate-200 rounded-xl shadow-sm` |
| ヘッダーバー背景 | `bg-slate-50/50` |
| ヘッダーバー高さ | `h-11` (44px) |
| 区切り線 | `border-b border-slate-200` |
| プライマリテキスト | `text-slate-800` |
| セカンダリテキスト | `text-slate-600` / `text-slate-700` |
| ヒント / 注釈 | `text-slate-400` `text-[10px]` / `text-[11px]` |
| ドラフトバッジ (赤) | `bg-red-100 text-red-700` |
| レポートバッジ (青) | `bg-blue-100 text-blue-700` |
| 編集中バッジ (amber) | `bg-amber-100 text-amber-700 border-amber-200` |
| 共有中バッジ (emerald) | `bg-emerald-50/60 text-emerald-700 border-emerald-200` |
| 保留 / 警告 (amber) | `text-amber-600 bg-amber-50` |
| 失効間近 (amber) | `bg-amber-100 text-amber-800` |
| primary ボタン背景 | `bg-slate-800 hover:bg-slate-900 text-white` |
| disabled | `disabled:opacity-40 disabled:cursor-not-allowed` |

### 0.2 共通コンポーネント: `IconButton` (Canvas / 共通アクション)

**実体**: [src/components/advisor/report/report-canvas.tsx:1457-1493](../src/components/advisor/report/report-canvas.tsx)

```ts
function IconButton({ children, onClick, disabled, title, tone })
```

| Prop | 型 | 用途 |
|---|---|---|
| `children` | ReactNode | アイコン (lucide-react から、`h-3.5 w-3.5` 想定) |
| `onClick` | `() => void \| Promise<void>` | クリックハンドラ |
| `disabled` | boolean | true なら半透明 + cursor-not-allowed |
| `title` | string | **必須**。マウスオーバー tooltip 文言 (aria-label にも適用) |
| `tone` | `'default' \| 'primary' \| 'amber' \| 'emerald'` | 配色 |

**重要なルール (絶対遵守)**:
- 全ての IconButton は **`<span title>` でラップ** (`<button disabled title>` は Chrome で tooltip 出ないため)
- `title` は省略不可 (アクセシビリティ + UX)
- アイコンサイズは `h-3.5 w-3.5` で統一 (14px)
- ボタン外形は `h-8 w-8` (32px) `rounded-md` `border`
- transition: `transition-colors` (色のみアニメ、size は変えない)

**tone 別の class**:
```
default:  text-slate-600 hover:bg-slate-100 border-transparent
primary:  bg-slate-800 text-white hover:bg-slate-900 border-slate-800
amber:    text-amber-600 hover:bg-amber-50 border-transparent
emerald:  text-emerald-700 bg-emerald-50/60 hover:bg-emerald-50 border-emerald-200
```

### 0.3 アイコン (lucide-react)

頻出アイコン (全て `h-3.5 w-3.5` で使用):

| アイコン | 用途 |
|---|---|
| `FileText` | レポート / プレビューのタイトル左に |
| `Pencil` | 編集モード入る (どこでも) |
| `RefreshCw` | レポート更新 / 再読み込み |
| `Trash2` | 削除 |
| `Share2` | 共有 |
| `Link2` / `Link2Off` | URL コピー / 公開停止 |
| `Bookmark` / `BookmarkCheck` | しおり OFF / ON |
| `MoreHorizontal` (⋯) | その他メニュー |
| `Sparkles` (✨) | レポート作成 (新規生成、primary トーンと組合せ) |
| `Copy` | コピー |
| `Check` | 完了 / 保存 |
| `X` | 閉じる / キャンセル |
| `Loader2 animate-spin` | ロード中 |
| `AlertCircle` | 警告 |
| `History` | バージョン履歴 |
| `ChevronDown` | ドロップダウン展開 |

---

## 1. メイン画面 (`/system-admin/advisor`)

### 1.1 レイアウト全体

3 カラム (全部 100vh、横並び):
```
┌──────────────┬───────────────────────────┬─────────────────────────────┐
│ サイドバー   │ チャット欄                │ ReportCanvas (右)           │
│ (折り畳み可) │                           │ (Canvas オープン時のみ表示) │
└──────────────┴───────────────────────────┴─────────────────────────────┘
```

外側コンテナ: `bg-slate-100 p-2.5` (灰色背景に 10px 余白) → 中の各カードが「浮かんで」見える。

### 1.2 サイドバー (`chat-layout.tsx` 内)

#### 1.2.1 開いている時 (デフォルト幅 240px)

```
┌─ ヘッダー (h-11 px-3) ─────────────────────────┐
│  ロゴアイコン  「Advisor」          [<] トグル │  ← bg-slate-50/50 border-b
├────────────────────────────────────────────────┤
│  [+ 新規チャット] (primary、ヘッダー直下)      │
├────────────────────────────────────────────────┤
│  📁 履歴一覧                                    │  ← セクション見出し text-[11px] text-slate-500
│  ┌───────────────────────────────────────────┐ │
│  │ 🔖 [選択中] レポートタイトル...     ⋯ 🔖  │ │  ← hover で右にしおりアイコン出現
│  │ チャットタイトル...                  ⋯    │ │
│  │ ...                                        │ │
│  └───────────────────────────────────────────┘ │
├────────────────────────────────────────────────┤
│  [⚙️ 設定] [📊 レポート履歴]                    │  ← フッター固定
└────────────────────────────────────────────────┘
```

**セッション行の挙動**:

| 状態 | 表示 |
|---|---|
| 通常 | `bg-white text-slate-700 hover:bg-slate-50` |
| 選択中 | `bg-slate-200 text-slate-900 font-medium` |
| しおり ON | 行頭に **常時** amber `Bookmark` アイコン (`text-amber-500`) |
| しおり OFF | hover 時のみアイコン表示 (`opacity-0 group-hover:opacity-100`) |

**しおりトグル動作**:
- アイコンクリック → `toggleBookmark` Server Action
- 楽観的 UI で即時 amber 表示 (DB 結果待たない)
- エラー時はトースト表示で revert

#### 1.2.2 折り畳まれた時 (幅 36px)

```
┌──┐
│ >│  ← 展開ボタン
│ +│  ← 新規チャットアイコン (Plus)
└──┘
```

- 展開時に Canvas が開いた瞬間 `prevCanvasOpenRef` で 1 回だけ自動折り畳み
- ユーザーが手動展開した後はその選択を維持

### 1.3 チャット欄

#### 1.3.1 メッセージリスト (上半分)

各メッセージは `unified-message.tsx` でレンダリング。

**メッセージ種別と表示**:

| role | 表示 |
|---|---|
| `user` | 右寄せ吹き出し (`bg-slate-100 rounded-2xl px-4 py-2`) |
| `assistant` | 左寄せ、アバターなし、`text-slate-800` で Markdown レンダリング |
| `tool` | 折り畳み式の "ツール実行" 表示 (`bg-slate-50 border rounded-md`、デフォルト畳む) |

**進捗表示 (assistant が応答中)**:
- アシスタントメッセージ最後尾に **heartbeat バッジ**: `⏳ 思考中 (5s) · 142 tokens`
- フェーズ別ラベル:
  - `thinking` → 「思考中」
  - `tool` → 「データを取得中 (`tool_name`)」
  - `streaming` → 「文章作成中」
  - `organizing` → 「整理中」
- 5 秒ごとに更新、経過秒数 + 出力トークン数を更新

**メッセージ先頭の絵文字ラベル** (assistant のレポート系応答時):
```
📋 ドラフトを作成しました
📝 ドラフトを更新しました
📊 レポート vN を生成しました
✏️ レポート vN を編集しました
🔄 自動再生成しました
```

**Markdown レンダラ仕様**:
- `<ul>`: `list-disc list-outside pl-5 my-2 space-y-1 marker:text-slate-400`
- `<ol>`: `list-decimal list-outside pl-5 my-2 space-y-1 marker:text-slate-400`
- `<li>`: `leading-relaxed`
- `<em>` で `出典:` で始まるテキスト → `block text-[10px] text-slate-400 mt-1 mb-2 not-italic` (グレー小フォント)
- `<table>` (GFM): `border-collapse w-full my-3 text-[12px]`、ヘッダ `bg-slate-50`

#### 1.3.2 入力欄 (下、`chat-input.tsx`)

```
┌─────────────────────────────────────────────────┐
│ [ツール ▼]  ┌─────────────────────────────┐    │
│             │ メッセージ入力 textarea     │ [▶] │
│             │ (auto-resize 1〜8 行)        │    │
│             └─────────────────────────────┘    │
│  💡 提案チップ × 4 (初回チャット画面のみ)        │
└─────────────────────────────────────────────────┘
```

**ツール ▼ (左の選択ドロップダウン)**:
- 通常時はクリックで開閉
- forcedTool が設定されている時は disabled で表示固定 (Canvas オープン時など)

**ツールメニューの内容** (forcedTool=null 時):
| 項目 | プレースホルダ追加 hint |
|---|---|
| 自動 (デフォルト) | なし |
| レポート作成 | `[TOOL:report_create]` |

**forcedTool での自動切替**:
- Canvas が draft タブ表示中: `forcedTool='draft_revise'` → 入力欄プレースホルダ「ドラフト修正指示」
- Canvas が result タブ表示中: `forcedTool='result_edit'` → 入力欄プレースホルダ「レポート修正指示」
- Canvas 閉じている時: forcedTool=null → 通常メニュー

**入力欄プレースホルダ**:

| forcedTool | placeholder |
|---|---|
| `null` (通常) | "Advisor に質問する..." |
| `report_create` | "どんなレポートを作りますか？(目的 / 期間 / データソース) " |
| `draft_revise` | "ドラフト修正指示 (例: LP5 まで増やして / アウトラインに考察を足して)" |
| `result_edit` | "レポート修正指示 (例: 3 章を簡潔に / 末尾に次回アクションを追加)" |

**送信ボタン (▶)**:
- 通常: `bg-slate-800 hover:bg-slate-900 text-white h-9 w-9 rounded-lg`
- 入力空 / 送信中: `disabled:opacity-40 cursor-not-allowed`
- 送信中: `Loader2 animate-spin`
- 送信中はクリックすると **abort** (中止) → SSE ストリームを切断

**送信トリガー**:
- Enter (Shift+Enter は改行)
- ▶ ボタンクリック

**suggestion チップ (初回チャット画面のみ表示)**:
[chat-layout.tsx で 4 個定義]

| # | テキスト | 動作 |
|---|---|---|
| 1 | 💡 「現在公開中の求人は何件?」 | クリック → 入力欄にプリフィル + 自動送信 |
| 2 | 📊 「先週の GA4 セッション数」 | 同上 |
| 3 | 🔍 「Job テーブルの構造を教えて」 | 同上 |
| 4 | 📝 **「ログを集計してレポート生成」** | クリック → ChatInput に `report_create` ツール選択 + テンプレ文章プリフィル (送信はしない) |

`prefill` prop の挙動 (#4 のみ特殊):
- `chat-input.tsx` の `prefill?: { toolId, text, nonce }` prop に値が来ると:
  - textarea に text を入れる
  - ツール選択を toolId に変える
  - textarea の auto-resize を発火
- 送信時に `setChatPrefill(null)` で必ずクリア (再マウント時の重複適用バグ防止)

### 1.4 ReportCanvas (右ペイン)

**表示条件**: ドラフトが存在するセッションを選択中、または `[TOOL:report_create]` を送信した瞬間

**外形**:
- 幅: デフォルト 960px、ユーザーがドラッグで 360〜(window.width - 320) px の範囲で調整可
- localStorage `advisor-canvas-width` に幅を保存
- 高さ: 100% (chat-layout の flex で chat 欄と等高)
- 外周: `bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden`

**境界 (リサイズハンドル)**:
- `w-1.5` (6px) の縦バー、デフォルト透明
- hover で `bg-blue-400/60` (青)
- ドラッグ中で `bg-blue-500` (濃い青)
- カーソル: `cursor-col-resize`

#### 1.4.1 状態遷移マトリクス

Canvas は **5 つの大きな状態** を取る。状態によってヘッダーとコンテンツが切り替わる:

| 状態 | 条件 | ヘッダー | コンテンツ |
|---|---|---|---|
| **A. ドラフトなし (loading)** | sessionId あり、draft 取得中 | "読み込み中..." | スケルトンプレースホルダ |
| **B. 楽観的 (作成 / 更新中)** | `chatPhase !== 'idle'` または `chatLoading` | ⏳ 作成中ヘッダー + 中止ボタン | 直前の draft (なければ空) |
| **C. ドラフト編集中 (manual)** | `editing` または `draftEdit !== null` | 編集中ヘッダー: ✕キャンセル / ✅保存 | 編集 textarea |
| **D. 通常表示 (draft タブ)** | draft あり、view='draft' | 通常ヘッダー (アクション群) | DraftBodyView (skeleton_markdown レンダリング) |
| **E. 通常表示 (result タブ)** | hasResult、view='result' | 通常ヘッダー | レポート本文 Markdown レンダリング |
| **F. 生成中 (generating)** | `generating` または `draft.status === 'generating'` | ⏳ レポート生成中ヘッダー + 中止ボタン | 直前のコンテンツ |

#### 1.4.2 ヘッダー詳細 (各状態別)

##### A. 読み込み中ヘッダー
```
[h-11 px-3 bg-slate-50/50]
[Loader2 animate-spin (slate-700)] 「読み込み中...」 [余白] [✕]
```

##### B. 楽観的 / drafting / updating ヘッダー (★楽観的 UI)
```
[h-11 px-3 bg-slate-50/50]
[Loader2 animate-spin (slate-700)] 「ドラフトを作成中...」 [余白] [✕ 中止] [✕ 閉じる]
```
- chatPhase=`drafting` → 「ドラフトを作成中...」
- chatPhase=`updating` → 「ドラフトを更新中...」
- 中止ボタンの style: `inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-red-600 hover:bg-red-50 border border-red-100`
- 中止ボタンクリック → `onCancelChatStream()` (SSE ストリーム abort)
- liveStatusText が SSE で来ていればそれを優先表示

##### C. 編集中ヘッダー
```
[h-11 px-3 bg-slate-50/50]
[FileText (slate-700)] 「編集中」 [amber EDITING バッジ] [余白] [✕] [✓保存]
```
- amber バッジ: `bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border` 文字 "EDITING"
- ✕ クリック → `setDraftEdit(null)` で編集破棄
- ✓ クリック → `updateDraftBulk()` Server Action 実行
- 保存中は ✓ → Loader2 animate-spin

##### D. ドラフト表示ヘッダー (通常 / view='draft')
```
[h-11 px-3 bg-slate-50/50]
[FileText] [タイトル (10 文字超で …)] [赤バッジ「ドラフト」]
[切替タブ (draft/result pill)] [bookmarked アイコン] [余白]
[✏️ 編集] [✨ レポート作成 (primary)]
[⋯ その他] [✕ 閉じる]
```

タブ pill (右の 2 ボタンセグメント):
- コンテナ: `inline-flex bg-slate-100 rounded-md p-0.5 text-[11px]`
- 各タブボタン: `px-2.5 py-0.5 rounded transition-colors`
- 選択中の draft タブ: `bg-red-100 text-red-700 font-medium shadow-sm`
- 非選択 draft タブ: `text-slate-600 hover:text-slate-900`
- 選択中の result タブ: `bg-blue-100 text-blue-700 font-medium shadow-sm` (hasResult のときのみ表示)
- draftIsStale (= レポート生成後にドラフト更新あり) のとき draft タブに `1.5×1.5 rounded-full bg-amber-500` ドット表示

##### E. レポート表示ヘッダー (通常 / view='result')
```
[h-11 px-3 bg-slate-50/50]
[FileText] [タイトル (10 文字超で …)] [青バッジ「レポート (v3)」]
[draft/result タブ] [バージョンドロップダウン ▼]
[✏️ 編集] [🔄 (レポート更新)] [🔗 共有 (Share2)] [⋯] [✕]
```

各 IconButton 詳細:

| アイコン | tone | title | disabled 条件 | onClick |
|---|---|---|---|---|
| `Pencil` | default | "このバージョンを直接編集 (保存で新バージョン)" | `!activeVersion \|\| activeVersion.lockedByOther` | `handleStartEdit` |
| `RefreshCw` | default | "最新のデータでレポート本文を再生成 (新バージョン)" | `!canGenerate` | `handleGenerate` |
| `Share2` または `Loader2` | default / emerald | shareToken なら "共有中 (メニューを開く)" / "共有" | `shareLoading` | `setShareMenuOpen(v => !v)` |
| `MoreHorizontal` | default | "その他のオプション" | (なし) | `setMoreMenuOpen(v => !v)` |
| `X` | default | "閉じる" | (なし) | `onClose` |

**「lockedByOther」とは**: 他の admin が編集中 (5 分タイムアウト) の場合 disabled になる。
title は "別の管理者が編集中です" に変わる。

##### F. レポート生成中ヘッダー (Gemini 動作中)
```
[h-11 px-3 bg-slate-50/50]
[Loader2 animate-spin] 「レポートを生成しています...」 [余白] [✕ 中止] [✕]
```
- 中止ボタンクリック → `generateAbortRef.current?.abort()` (fetch abort)
- 中止後: status='failed' で残る、再生成可能

#### 1.4.3 共有メニュー (Share2 押下時に展開)

ドロップダウン位置: ボタン下 right-0、`absolute top-full mt-1 right-0 w-64 bg-white rounded-md border border-slate-200 shadow-lg p-2 z-30`

#### 1.4.3.1 共有 OFF 時 (まだ token 無し)

```
┌──────────────────────────────────────┐
│  📋 本文をコピー                       │
├──────────────────────────────────────┤
│  🔗 公開 URL を発行                    │  ← 新規 token 発行
└──────────────────────────────────────┘
```

#### 1.4.3.2 共有 ON 時 (token あり)

```
┌──────────────────────────────────────┐
│  📋 本文をコピー                       │
│  🔗 URL をコピー                       │
├──────────────────────────────────────┤
│  公開期限: あと 27 日                  │  ← 残日数 (灰色 / 7 日未満は amber)
│  公開者: 川島一郎                       │
├──────────────────────────────────────┤
│  ⏰ +30 日延長                          │
│  🚫 公開停止                            │  ← 赤系
└──────────────────────────────────────┘
```

各メニュー行の style: `flex items-center gap-2 px-2 py-1.5 text-[12px] rounded hover:bg-slate-100 cursor-pointer`

#### 1.4.4 その他メニュー (⋯ 押下時に展開)

```
┌──────────────────────────────────────┐
│  保持期間バナー (RetentionMenuItem)    │  ← しおりなしならグレー / amber
│   - bookmarked: 緑「永続保存中」       │
│   - 残 7 日以上: 「保存期間: あと N 日」 │
│   - 残 7 日未満: amber「⚠️ あと N 日で削除」│
├──────────────────────────────────────┤
│  🔖 / 🔖✓  しおり (永続保存)            │  ← しおり ON/OFF トグル
├──────────────────────────────────────┤
│  🗑️  削除                               │  ← 赤系、確認ダイアログあり
└──────────────────────────────────────┘
```

「削除」のクリック挙動:
- 1 回目クリック: ボタンが「🗑️ 本当に削除? (再クリックで実行)」に変わる
- 5 秒以内に再クリック: 削除実行 → セッションごとアーカイブ
- 5 秒経過: 元の表示に戻る

#### 1.4.5 コンテンツエリア

##### 1.4.5.1 DraftBodyView (view='draft')

要件 + skeleton を表示。要件は折り畳み (デフォルト畳む)。

```
┌────────────────────────────────────────┐
│ レポートプレビュー (skeleton_markdown)   │
│ [Markdown レンダリング、テーブル / 章]    │
│ [✏️ 手動編集ボタン (右下に小)]           │
├────────────────────────────────────────┤
│ ▼ レポート要件 (折り畳み、クリックで展開) │  ← デフォルト閉じている
│   ・タイトル (input)                    │
│   ・目的 (textarea, 3 行)                │
│   ・期間 (date picker × 2)               │
│   ・データソース (チェックボックス × 10)  │
│   ・取得指標 (checkbox × 14, 利用可のみ) │
│   ・アウトライン (textarea, 5 行)        │
│   ・追加メモ (textarea, 3 行)            │
└────────────────────────────────────────┘
```

要件編集中 (`draftEdit !== null`) の挙動:
- 各フィールド変更で `setDraftEdit(...)` 更新
- ヘッダー右に [✕ キャンセル] [✓ ドラフト更新] が出現 (footer 廃止後はヘッダーに集約)
- ポーリングが停止 (Claude が同時に書き換えない)
- チャット送信がトリガされた瞬間 `discardEditTrigger` 増加 → `draftEdit=null` リセット (未保存破棄)

「✏️ 手動編集」ボタン → skeleton_markdown を textarea で直接編集モードに

##### 1.4.5.2 レポート結果ビュー (view='result')

```
┌────────────────────────────────────────┐
│ # レポートタイトル                       │
│                                        │
│ ## サマリ                               │
│ ...本文...                              │
│                                        │
│ ## 主要数値                             │
│ | 指標 | 値 |                            │
│ |---|---|                                │
│ ...                                     │
│ *集計期間: ... / 出典: ...*             │  ← グレー小フォント (em カスタム)
└────────────────────────────────────────┘
```

ScrollArea でスクロール可、`p-4 text-sm` でパディング。

### 1.5 進行中アニメーション (削除済み)

**注**: かつて Canvas のヘッダー直下に「青い shimmer バナー」が出ていたが、
2026-05-04 に **状態専用ヘッダーで統一** したため廃止。
今は ⏳ + テキスト + 中止ボタンが Canvas ヘッダー自体に表示される (1.4.2 B / F 参照)。

---

## 2. 履歴一覧画面 (`/system-admin/advisor/history`)

`history-client.tsx` で実装。

```
┌─ ヘッダー (h-12 px-4) ───────────────────┐
│ ← 戻る  チャット履歴                      │
├──────────────────────────────────────────┤
│ ┌─ セッション行 ──────────────────────┐  │
│ │ 🔖 [タイトル...]                  ⋯  │  │
│ │ 最終更新: 2026-05-04 14:23 (3 件)    │  │
│ └────────────────────────────────────┘  │
│ ...                                       │
└──────────────────────────────────────────┘
```

- セッション行 hover で背景 `bg-slate-50`
- しおり ON 行は左端に amber bookmark アイコン (常時)
- ⋯ メニューでアーカイブ / 削除

---

## 3. レポート履歴画面 (`/system-admin/advisor/reports`)

全セッション横断でレポートバージョン (`AdvisorReportVersion`) を一覧。

```
┌─ ヘッダー ───────────────────────────────┐
│ ← 戻る  レポート履歴                      │
├──────────────────────────────────────────┤
│ ┌─ バージョン行 ──────────────────────┐  │
│ │ [v3] レポートタイトル                │  │
│ │ 生成: 2026-05-04 14:23 / モデル: ... │  │
│ │ source: generated / 0.32s            │  │
│ │ [👁️ 詳細] [🗑️]                       │  │
│ └────────────────────────────────────┘  │
│ ...                                       │
└──────────────────────────────────────────┘
```

詳細ボタン → `/system-admin/advisor/reports/[versionId]` (個別バージョン詳細表示)

---

## 4. 設定ページ (`/system-admin/advisor/settings`)

```
┌─ ヘッダー ───────────────────────────────┐
│ ← 戻る  Advisor 設定                     │
├──────────────────────────────────────────┤
│ # 全般                                    │
│ ┌────────────────────────────────────┐  │
│ │ ツール実行ループ上限: [20]           │  │
│ │ プライマリモデル: [claude-sonnet-4-6 ▼]│  │
│ │ ループ後モデル: [(プライマリと同じ) ▼] │  │
│ └────────────────────────────────────┘  │
│                                          │
│ # システムプロンプト上書き                │
│ [textarea 大]                            │
│                                          │
│ # 月次使用統計                            │
│ [テーブル: 月別 input/output/cost]       │
└──────────────────────────────────────────┘
```

---

## 5. 公開シェアページ (`/advisor/r/[token]`)

**認証なし** (middleware の publicPaths に `/advisor/r/` を追加)。

```
┌──────────────────────────────────────────┐
│ TASTAS Advisor                            │  ← ヘッダー (シンプル)
│                                          │
│         レポートタイトル                   │
│                                          │
│         🔵 公開期限: あと 27 日            │  ← 残日数バッジ (色は段階的)
│         共有: 川島一郎                     │
├──────────────────────────────────────────┤
│ # レポート本文                            │
│ ...Markdown レンダリング...               │
└──────────────────────────────────────────┘
```

**残日数バッジの色** (RetentionBanner と同じロジック):
- 7 日以上: `bg-slate-100 text-slate-600` (グレー)
- 1-7 日: `bg-amber-100 text-amber-700` (amber)
- 0 日 (失効済み): 404 ページに置き換わる

**SEO**: 将来 `<meta name="robots" content="noindex">` 追加予定 (現状未対応)。

---

## 6. レイアウト寸法 (px 単位、再現用)

| 要素 | サイズ |
|---|---|
| ヘッダーバー高 | 44px (`h-11`) |
| IconButton | 32×32 px (`h-8 w-8`) |
| アイコン | 14×14 px (`h-3.5 w-3.5`) |
| サイドバーデフォルト幅 | 240px |
| サイドバー折り畳み幅 | 36px |
| Canvas デフォルト幅 | 960px |
| Canvas 最小幅 | 360px |
| 外周パディング | 10px (`p-2.5`) |
| カード border-radius | 12px (`rounded-xl`) |
| ボタン border-radius | 6px (`rounded-md`) |
| シャドウ | `shadow-sm` (Tailwind 標準) |
| リサイズハンドル幅 | 6px (`w-1.5`) |

---

## 7. 状態管理の流れ (重要)

### 7.1 親 (chat-layout) の state (Canvas 連動)

```ts
const [chatLoading, setChatLoading] = useState(false)
const [chatPhase, setChatPhase] = useState<'idle' | 'drafting' | 'updating'>('idle')
const [canvasOpen, setCanvasOpen] = useState(false)
const [discardEditTrigger, setDiscardEditTrigger] = useState(0)
const [chatPrefill, setChatPrefill] = useState<{toolId, text, nonce} | null>(null)
const handleAbort = () => abortControllerRef.current?.abort()
```

### 7.2 Canvas 内の state

```ts
const [draft, setDraft] = useState<...>()
const [versions, setVersions] = useState<...[]>([])
const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
const [view, setView] = useState<'draft' | 'result'>('draft')
const [editing, setEditing] = useState(false)
const [draftEdit, setDraftEdit] = useState<...|null>(null)  // 要件編集中
const [generating, setGenerating] = useState(false)
const [shareMenuOpen, setShareMenuOpen] = useState(false)
const [moreMenuOpen, setMoreMenuOpen] = useState(false)
const [bookmarked, setBookmarked] = useState(false)
```

### 7.3 ポーリング (段階的)

```ts
useEffect(() => {
  // アクティブ時 (chatPhase / chatLoading / generating / draft.status='generating')
  // → 2 秒間隔
  // idle 時 → 8 秒間隔
  const isActive = chatPhase !== 'idle' || chatLoading || generating || draft?.status === 'generating'
  const intervalMs = isActive ? 2000 : 8000
  pollRef.current = window.setInterval(reload, intervalMs)
}, [reload, chatPhase, chatLoading, generating, draft?.status])
```

**絶対ルール**: 「ポーリング停止条件」は作らない。最悪 8 秒で必ず最新化される。
理由: [knowledge/ANTI_PATTERNS.md](../knowledge/ANTI_PATTERNS.md) 参照。

### 7.4 Canvas / チャット間の連動

| イベント | 起こること |
|---|---|
| ユーザーが Canvas でフィールド編集開始 (`draftEdit != null`) | reload 内部 `if (draftEdit !== null) return` で DB 上書き阻止 |
| ユーザーがチャットで送信 | `discardEditTrigger++` → Canvas の useEffect が拾う → `setDraftEdit(null)` で未保存破棄 |
| Canvas タブ切替 (draft ↔ result) | `onViewChange({view, hasResult})` callback → chat-layout が forcedTool を切替 |
| Canvas でレポート生成完了 | `onReportGenerated()` callback → chat-layout がチャット履歴 reload |
| Canvas が「閉→開」遷移 | `prevCanvasOpenRef` で 1 回だけサイドバー折り畳み |

---

## 8. アクセシビリティ

- 全ての IconButton に `aria-label`
- 全ての form input に label or aria-label
- Tab キーで合理的な順序で移動
- ESC キーで開いているメニュー / モーダル閉じる
- スクリーンリーダ対応: `role="status"` `aria-live="polite"` を進捗表示に

---

## 9. レスポンシブ

**現状**: モバイル対応なし。`lg:` breakpoint 以上 (1024px 以上) を想定。
モバイルでは Canvas が表示されない設計。

---

## 10. 関連ファイル

| ファイル | 役割 |
|---|---|
| `src/components/advisor/report/report-canvas.tsx` | Canvas 本体 (~1700 行) |
| `src/components/advisor/chat/chat-layout.tsx` | サイドバー + チャット + Canvas 統合 (~1700 行) |
| `src/components/advisor/chat/chat-input.tsx` | ChatInput (forcedTool / prefill) |
| `src/components/advisor/chat/unified-message.tsx` | メッセージレンダラ |
| `src/components/advisor/history/history-client.tsx` | 履歴一覧 |
| `src/components/advisor/reports/reports-list.tsx` | レポート横断一覧 |
| `src/components/advisor/reports/report-detail.tsx` | バージョン詳細 |
| `app/advisor/r/[token]/page.tsx` | 公開シェアページ |
| `app/system-admin/advisor/page.tsx` | メイン画面 |
| `app/system-admin/advisor/settings/page.tsx` | 設定ページ |
| `extra-config/middleware.ts` | publicPaths に `/advisor/r/` |
| `extra-config/globals.css` | Tailwind preflight (bullet 注意) |
| `extra-config/tailwind.config.ts` | 色設定 |

---

## 11. 注意点 / よくある罠

### 11.1 disabled button の tooltip
- `<button disabled title="...">` は Chrome で tooltip 表示されない
- 必ず `<span title="..."><button disabled>` でラップ
- `IconButton` 共通コンポーネントは既に対応済み

### 11.2 Markdown bullet が消える
- Tailwind preflight が `<ul>` `<ol>` のリストスタイルをリセット
- `@tailwindcss/typography` (prose) は未導入
- → ReactMarkdown の `components` prop で `ul/ol/li` を明示スタイル化 (本ドキュメント §1.3.1 参照)

### 11.3 prefill 重複適用バグ
- ChatInput が `key={conversationId}` で再マウントされた瞬間に prefill が再適用される
- → 送信時に必ず `setChatPrefill(null)` でクリア

### 11.4 ポーリング停止しない
- 「draft.status='completed' になったら止める」のような最適化は **絶対にやらない**
- 理由: ユーザーが別タブでチャット送信した場合などに反映されない事故になる
- 最悪 8 秒で必ず最新化される設計を維持
