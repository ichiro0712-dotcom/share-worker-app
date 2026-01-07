# 無料LLM用指示書: 管理画面スタイル統一タスク

## 作業の目的

施設管理画面（`/admin/*`）のスタイルをスタイルガイド（`/style-guide`）に完全に統一する。
ワーカー画面では `primary`（赤）を使用し、管理画面では `admin-primary`（青）を使用する。

---

## スタイルルール（これに従う）

| 要素 | 管理画面で使うべきクラス | 誤って使われているクラス |
|------|------------------------|------------------------|
| アクションボタン背景 | `bg-admin-primary` | `bg-green-600`, `bg-primary` |
| アクションボタンホバー | `hover:bg-admin-primary-dark` | `hover:bg-green-700` |
| フォーカスリング | `focus:ring-admin-primary` | `focus:ring-primary` |
| ホバーテキスト | `hover:text-admin-primary` | `hover:text-primary` |
| テキストカラー | `text-admin-primary` | `text-primary` |

**注意**: ステータス表示（公開中=緑、停止中=グレーなど）は変更しない。変更するのはアクションボタンとフォーム要素のみ。

---

## タスク1: 緑ボタンを青に統一

### 対象ファイル: `app/admin/jobs/page.tsx`

#### 変更箇所1: 405行目付近（公開するボタン）
```tsx
// 検索
bg-green-600 text-white rounded-admin-button hover:bg-green-700

// 置換
bg-admin-primary text-white rounded-admin-button hover:bg-admin-primary-dark
```

#### 変更箇所2: 765行目付近（一括操作確認モーダル）
```tsx
// 検索
'bg-green-600 hover:bg-green-700'

// 置換
'bg-admin-primary hover:bg-admin-primary-dark'
```

---

## タスク2: フォーカスリングを統一

以下のファイルで `focus:ring-primary` を `focus:ring-admin-primary` に一括置換する。

### 対象ファイル一覧

| ファイル | 箇所数 |
|----------|--------|
| `app/admin/facility/page.tsx` | 約40箇所 |
| `app/admin/workers/page.tsx` | 5箇所 |
| `app/admin/messages/page.tsx` | 3箇所 |
| `app/admin/reviews/page.tsx` | 1箇所 |
| `app/admin/workers/[id]/review/page.tsx` | 2箇所 |

### 置換ルール
```
検索: focus:ring-primary
置換: focus:ring-admin-primary
```

**注意**: `focus:ring-admin-primary` になっている箇所は変更しない（二重置換を避ける）

### 具体的なコマンド（参考）
各ファイルを開いて、エディタの検索置換機能（Cmd+H または Ctrl+H）で以下を実行：
- 検索: `focus:ring-primary`（正規表現OFF）
- 置換: `focus:ring-admin-primary`
- 「すべて置換」を実行

---

## タスク3: ホバーテキストを統一

### 対象ファイル: `app/admin/applications/page.tsx`

#### 変更箇所: 537行目付近
```tsx
// 検索
hover:text-primary hover:underline

// 置換
hover:text-admin-primary hover:underline
```

---

## タスク4: チェックボックスのカラーを統一

### 対象ファイル: `app/admin/workers/page.tsx`

#### 変更箇所: 301, 310, 319行目付近
```tsx
// 検索
text-primary focus:ring-primary

// 置換
text-admin-primary focus:ring-admin-primary
```

### 対象ファイル: `app/admin/facility/page.tsx`

#### 変更箇所: 729, 914, 1071, 1082行目付近
```tsx
// 検索
text-primary focus:ring-primary

// 置換
text-admin-primary focus:ring-admin-primary
```

---

## タスク5: ローディングスピナーの色を統一（任意）

管理画面のローディングスピナーは `border-primary` ではなく `border-admin-primary` を使用すべき。

### 対象ファイル（複数）
- `app/admin/reviews/page.tsx` 145行目
- `app/admin/page.tsx` 92, 100行目
- `app/admin/jobs/page.tsx` 370行目
- `app/admin/workers/page.tsx` 262行目
- `app/admin/jobs/[id]/page.tsx` 97行目
- `app/admin/applications/page.tsx` 222, 622行目
- `app/admin/jobs/[id]/edit/page.tsx` 234行目
- `app/admin/jobs/new/page.tsx` 144行目
- `app/admin/workers/[id]/review/page.tsx` 112行目

### 置換ルール
```
検索: border-b-2 border-primary
置換: border-b-2 border-admin-primary
```

---

## 変更してはいけない箇所

以下は**変更しない**こと：

1. **ステータスバッジの色**
   - `bg-green-100 text-green-700`（公開中）
   - `bg-green-600`（公開中バッジ）
   - これらはステータスを表す色なので変更不要

2. **プログレスバーの色**
   - `bg-green-500`（充足率100%以上）
   - `bg-blue-500`（充足率100%未満）
   - これらは進捗を表す色なので変更不要

3. **アバター・アイコン背景の `rounded-full`**
   - アバターやアイコン背景の丸みは変更不要

4. **ワーカー画面（`app/admin/` 以外）**
   - ワーカー画面は `primary` を使用するので変更不要

---

## 作業完了後の必須手順

⚠️ **重要**: 以下の手順を必ず実行してください。スキップするとCSSが反映されません。

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

### 5. ブラウザでハードリロード
- **Mac**: `Cmd + Shift + R`
- **Windows**: `Ctrl + Shift + R`

### 6. 動作確認チェックリスト
- [ ] `/admin/jobs` の「公開する」ボタンが青色
- [ ] `/admin/facility` のフォーカスリングが青色
- [ ] `/admin/workers` の検索ボックスのフォーカスリングが青色
- [ ] `/admin/messages` の入力欄のフォーカスリングが青色
- [ ] `/admin/applications` のワーカー名リンクのホバー色が青色

### 7. 報告形式
```
## 作業完了報告

### 変更したファイル
- ファイル名: 変更箇所数

### キャッシュクリア実行
- [x] pkill -f "next" 実行
- [x] rm -rf .next node_modules/.cache 実行
- [x] npm run build 成功
- [x] npm run dev 起動確認

### 動作確認
- [x] /admin/jobs - 公開ボタン青色確認
- [x] /admin/facility - フォーカスリング青色確認
```

---

## 変更対象ファイル一覧（まとめ）

| ファイル | タスク | 変更内容 |
|----------|--------|----------|
| `app/admin/jobs/page.tsx` | 1 | 緑ボタン→青 (2箇所) |
| `app/admin/facility/page.tsx` | 2, 4 | focus:ring + checkbox色 (約44箇所) |
| `app/admin/workers/page.tsx` | 2, 4 | focus:ring + checkbox色 (8箇所) |
| `app/admin/messages/page.tsx` | 2 | focus:ring (3箇所) |
| `app/admin/reviews/page.tsx` | 2 | focus:ring (1箇所) |
| `app/admin/workers/[id]/review/page.tsx` | 2 | focus:ring (2箇所) |
| `app/admin/applications/page.tsx` | 3 | hover:text-primary (1箇所) |

**合計**: 約60箇所の変更
