# 管理画面デザイン統一計画書

## 概要

管理画面のステータスバッジをスタイルガイドの「パターン9: ドットインジケーター」に統一する計画。
タグ（仕事内容・資格・経験）は現状維持し、スタイルガイドに追記する。

---

## パターン9: ドットインジケーター仕様

```tsx
// 基本形式
<span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 flex items-center gap-1.5">
  <span className="w-2 h-2 rounded-full bg-{color}-500"></span>
  {ラベル}
</span>

// カラー対応
- 公開中/募集中: bg-green-500
- 停止中/下書き: bg-gray-400
- 勤務中: bg-blue-500
- 評価待ち: bg-amber-500
- 完了: bg-gray-400
- 不成立/キャンセル: bg-red-500
```

---

## 作業分類

### 🔴 高難度（自分で実施）

statusConfigオブジェクトの再構築やJSX構造変更が必要な作業。

#### 1. [app/admin/jobs/page.tsx](../app/admin/jobs/page.tsx)
- **行260-266**: statusConfigをドットインジケーター形式に変更
- **行593-596**: ステータスバッジ表示部分をflexbox + dotに変更
- **理由**: statusConfigの構造変更 + JSX構造の変更が必要

#### 2. [app/admin/workers/page.tsx](../app/admin/workers/page.tsx)
- **行345-349**: ステータスフィルターボタンの色（変更しない：フィルターUI用）
- **行415-434**: 左上三角リボン（ステータス表示）- 特殊UIのため現状維持を推奨
- **理由**: 三角リボンUIは特殊パターン、ドットインジケーターに置換不可

#### 3. スタイルガイド更新 [app/style-guide/page.tsx](../app/style-guide/page.tsx)
- タグセクションを追加（仕事内容・資格・経験の現行スタイル）
- **理由**: 新規セクション追加と構造設計が必要

---

### 🟡 中難度（自分で実施 or 詳細指示付きで無料LLM）

単一ファイルでstatusLabelとstatusColorのマッピング変更。

#### 4. [app/admin/jobs/[id]/page.tsx](../app/admin/jobs/[id]/page.tsx)
- **行106-120**: statusLabel/statusColor定義
- **行138-139**: バッジ表示部分
- **変更内容**: JSX構造をドットインジケーターに変更

```tsx
// Before (行138-139)
<span className={`px-2 py-1 text-xs font-medium rounded ${statusColor}`}>
  {statusLabel}
</span>

// After
<span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 flex items-center gap-1.5">
  <span className={`w-2 h-2 rounded-full ${statusDotColor}`}></span>
  {statusLabel}
</span>

// statusDotColorマッピング追加
const statusDotColor = {
  PUBLISHED: 'bg-green-500',
  DRAFT: 'bg-gray-400',
  STOPPED: 'bg-gray-400',
  COMPLETED: 'bg-gray-400',
  CANCELLED: 'bg-red-500',
}[job.status] || 'bg-gray-400';
```

#### 5. [app/admin/applications/page.tsx](../app/admin/applications/page.tsx)
- **行301-302**: 求人カードのステータスバッジ
- **行373-374**: 選択中求人のステータスバッジ
- **変更内容**: 2箇所をドットインジケーターに変更

```tsx
// Before (行301-302)
<span className={`px-2 py-0.5 text-xs font-medium rounded ${job.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
  {job.status === 'PUBLISHED' ? '公開中' : '停止中'}
</span>

// After
<span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 flex items-center gap-1.5">
  <span className={`w-2 h-2 rounded-full ${job.status === 'PUBLISHED' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
  {job.status === 'PUBLISHED' ? '公開中' : '停止中'}
</span>
```

#### 6. [app/admin/workers/[id]/page.tsx](../app/admin/workers/[id]/page.tsx)
- **行276**: 「募集中」バッジ
- **変更内容**: ドットインジケーターに変更

```tsx
// Before
<span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">募集中</span>

// After
<span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 flex items-center gap-1.5">
  <span className="w-2 h-2 rounded-full bg-green-500"></span>
  募集中
</span>
```

---

### 🟢 低難度（無料LLMに委託可能）

単純な文字列置換で対応可能な作業。

#### 7. [app/admin/page.tsx](../app/admin/page.tsx) - ダッシュボード
- **行158**: 本日の勤務カード（bg-orange-100 text-orange-700）
- **行196**: 未確認メッセージカード（bg-red-100 text-red-700）
- **行271**: 今週の予定カード（bg-blue-100 text-blue-700）
- **判断**: これらはステータスバッジではなく「通知カウント」なので現状維持推奨

#### 8. 変更不要と判断したファイル

以下は「ステータスバッジ」ではなく別用途のため変更対象外：

| ファイル | 行 | 理由 |
|---------|-----|------|
| reviews/page.tsx | 279,393,411,433 | 評価スコア表示・別用途 |
| login/page.tsx | 71 | エラーメッセージ |
| facility/page.tsx | 514,1095 | フォーム入力・情報表示 |
| messages/page.tsx | 236,449 | アバター・タグ |
| jobs/[id]/edit/page.tsx | 794,924,1076,1277,1309,1396 | フォーム入力・タグ |
| jobs/templates/*.tsx | 全て | フォーム入力・タグ |
| jobs/new/page.tsx | 1286,1318,1438 | フォーム入力・タグ |
| worker-reviews/page.tsx | 423 | ボタン |

---

## 実施順序

### Phase 1: 高難度作業（自分で実施）

1. **jobs/page.tsx** - statusConfigの再構築
2. **スタイルガイド更新** - タグセクション追加

### Phase 2: 中難度作業（自分 or 詳細指示付き無料LLM）

3. **jobs/[id]/page.tsx** - ステータスバッジ変更
4. **applications/page.tsx** - 2箇所変更
5. **workers/[id]/page.tsx** - 募集中バッジ変更

### Phase 3: 確認

6. 全ページの目視確認
7. ビルドテスト

---

## 無料LLM用タスク指示書

### タスク: applications/page.tsx のステータスバッジ変更

**ファイル**: `app/admin/applications/page.tsx`

**変更箇所1 (行301-302)**:
```tsx
// 検索する文字列
<span className={`px-2 py-0.5 text-xs font-medium rounded ${job.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
  {job.status === 'PUBLISHED' ? '公開中' : '停止中'}
</span>

// 置換後
<span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 flex items-center gap-1.5">
  <span className={`w-2 h-2 rounded-full ${job.status === 'PUBLISHED' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
  {job.status === 'PUBLISHED' ? '公開中' : '停止中'}
</span>
```

**変更箇所2 (行373-374)**:
```tsx
// 検索する文字列
<span className={`px-2 py-0.5 text-xs font-medium rounded ${selectedJob.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
  {selectedJob.status === 'PUBLISHED' ? '公開中' : '停止中'}
</span>

// 置換後
<span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 flex items-center gap-1.5">
  <span className={`w-2 h-2 rounded-full ${selectedJob.status === 'PUBLISHED' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
  {selectedJob.status === 'PUBLISHED' ? '公開中' : '停止中'}
</span>
```

**確認方法**: `npm run build` でエラーがないこと

---

### タスク: workers/[id]/page.tsx の募集中バッジ変更

**ファイル**: `app/admin/workers/[id]/page.tsx`

**変更箇所 (行276)**:
```tsx
// 検索する文字列
<span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">募集中</span>

// 置換後
<span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 flex items-center gap-1.5">
  <span className="w-2 h-2 rounded-full bg-green-500"></span>
  募集中
</span>
```

**確認方法**: `npm run build` でエラーがないこと

---

### タスク: jobs/[id]/page.tsx のステータスバッジ変更

**ファイル**: `app/admin/jobs/[id]/page.tsx`

**変更箇所1 (行114-120を以下に変更)**:
```tsx
// 削除
const statusColor = {
  PUBLISHED: 'bg-green-100 text-green-700',
  DRAFT: 'bg-gray-100 text-gray-600',
  STOPPED: 'bg-gray-100 text-gray-600',
  COMPLETED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-red-100 text-red-700',
}[job.status] || 'bg-gray-100 text-gray-600';

// 追加
const statusDotColor = {
  PUBLISHED: 'bg-green-500',
  DRAFT: 'bg-gray-400',
  STOPPED: 'bg-gray-400',
  COMPLETED: 'bg-gray-400',
  CANCELLED: 'bg-red-500',
}[job.status] || 'bg-gray-400';
```

**変更箇所2 (行138-140)**:
```tsx
// 検索する文字列
<span className={`px-2 py-1 text-xs font-medium rounded ${statusColor}`}>
  {statusLabel}
</span>

// 置換後
<span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 flex items-center gap-1.5">
  <span className={`w-2 h-2 rounded-full ${statusDotColor}`}></span>
  {statusLabel}
</span>
```

**確認方法**: `npm run build` でエラーがないこと

---

## タグスタイル一覧（現状維持・スタイルガイドに追記）

### ワーカー画面のタグ

| 種類 | スタイル | 使用箇所 |
|------|---------|---------|
| 仕事内容タグ | `bg-gray-100 text-gray-600 text-xs rounded` | JobDetailClient.tsx |
| 資格タグ | `bg-blue-50 text-blue-700 border border-blue-200` | Tag component |
| 特徴タグ | `bg-green-100 text-green-800` | JobDetailClient.tsx |
| 週頻度 | `bg-orange-100 text-orange-700` | JobDetailClient.tsx |
| 月コミット | `bg-purple-100 text-purple-700` | JobDetailClient.tsx |

### 管理画面のタグ

| 種類 | スタイル | 使用箇所 |
|------|---------|---------|
| 仕事内容 | `bg-gray-100 text-gray-600` | applications/page.tsx, jobs/page.tsx |
| 資格 | `bg-blue-50 text-blue-700` | applications/page.tsx, workers/[id]/page.tsx |
| 経験分野 | 分野別色分け（getExperienceColor関数） | workers/[id]/page.tsx |
| 移動手段 | `bg-gray-100 text-gray-700` | jobs/page.tsx |

---

## 補足

### 変更しない理由のあるUI

1. **workers/page.tsx の三角リボン**: ワーカー一覧のカード左上に配置される特殊UIで、ドットインジケーターへの置換は不適切
2. **ダッシュボードの通知カウント**: ステータスではなく「件数表示」用途
3. **フィルターボタン**: アクティブ/非アクティブの状態表示用途で、ステータスバッジとは異なる

### 注意事項

- フィルターボタンの「選択時」スタイルは変更不要（bg-green-600等のactiveColor）
- 求人一覧のステータスフィルターは現状維持

---

## 作業完了後の必須手順

⚠️ **重要**: 以下の手順を必ず実行してください。

**詳細手順は `docs/LLM_CACHE_CLEAR_PROCEDURE.md` を参照してください。**

### 簡易版（最低限これを実行）

```bash
# 1. サーバー停止
pkill -f "next"

# 2. キャッシュ削除（両方必須！）
rm -rf .next node_modules/.cache

# 3. ビルド（エラーがあれば修正）
npm run build

# 4. サーバー起動
npm run dev -- --hostname 0.0.0.0
```

### ブラウザでハードリロード
- **Mac**: `Cmd + Shift + R`
- **Windows**: `Ctrl + Shift + R`
