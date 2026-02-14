# おすすめ求人ウィジェット 実装指示書

## 概要

LP（ZIPアップロード方式）に、管理画面で登録したおすすめ求人カードを表示するウィジェット機能を追加する。
LP作成者がHTML内の好きな位置に `<div data-tastas-jobs></div>` を書くと、その位置に求人カード一覧がiframeで表示される。

## 確定仕様

- **対象**: 通常LP（ZIP方式）のみ（LP0は対象外）
- **求人設定**: 全LP共通1セット（最大20件の求人ID）
- **表示ルール**: 締切済み・満員の求人もそのまま表示
- **日付選択**: あり（選択日に勤務可能な求人のみ表示、デフォルト3日後=index3）
- **タグ配置**: LP作成者がHTML内に手動で `<div data-tastas-jobs></div>` を記述
- **表示方式**: iframe内にNext.jsページ（`/lp/jobs-widget`）を表示
- **カード形式**: 既存のJobCardと同等の見た目（ただしiframe対応で`<a target="_top">`使用）
- **ブックマーク**: 非表示（isPublic=true）
- **リンク先**: `/public/jobs/{id}`（親ウィンドウで遷移）

---

## 実装手順（全11ステップ）

### Step 1: DBスキーマ追加

**ファイル**: `prisma/schema.prisma`

**変更内容**:

1. `RecommendedJob` モデルを追加（Jobモデルの `@@map("jobs")` の後、`JobWorkDate` モデルの前に追加）:

```prisma
model RecommendedJob {
  id         Int      @id @default(autoincrement())
  job_id     Int      @unique
  sort_order Int      @default(0)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  job Job @relation(fields: [job_id], references: [id], onDelete: Cascade)

  @@index([sort_order])
  @@map("recommended_jobs")
}
```

2. `Job` モデル（290行目〜384行目）にリレーション追加。`attendances Attendance[]` の後（370行目付近）に以下を追加:

```prisma
  recommendedJob           RecommendedJob?
```

**実行**: `npx prisma db push`

---

### Step 2: おすすめ求人管理API

**ファイル**: `app/api/recommended-jobs/route.ts`（新規作成）

**認証**: 必要（system-admin認証チェック）

**GET**: 登録済みおすすめ求人一覧取得
- `RecommendedJob` テーブルから `sort_order` 順に全件取得
- `job` リレーションで `id, title, status, facility(id, facility_name)` をinclude
- レスポンス形式:
```json
{
  "jobs": [
    {
      "id": 1,
      "sort_order": 0,
      "job": {
        "id": 34,
        "title": "看護師募集",
        "status": "PUBLISHED",
        "facility": { "id": 1, "facility_name": "さくら介護施設" }
      }
    }
  ]
}
```

**PUT**: おすすめ求人の一括更新（全削除→再登録）
- リクエスト: `{ jobIds: number[] }` （表示順序通りの配列、最大20件）
- バリデーション: 20件以下、重複なし
- トランザクション内で: `deleteMany()` → `createMany()`（sort_orderはindex順）
- レスポンス: `{ success: true, count: number }`

**求人検索用 GET（クエリ: ?search=xxx）**: 管理画面の求人検索用
- `search`パラメータがある場合は求人検索モード
- 求人ID（数値の場合）、タイトル（contains）、施設名（facility.facility_name contains）で検索
- 最大20件返却
- すでに登録済みの求人はexclude

---

### Step 3: おすすめ求人管理画面

**ファイル**: `app/system-admin/lp/recommended-jobs/page.tsx`（新規作成）

**URL**: `/system-admin/lp/recommended-jobs`

**UI構成**:
```
┌────────────────────────────────────────────┐
│ ← LP管理に戻る（Link href="/system-admin/lp"）│
│ おすすめ求人管理（全LP共通・最大20件）         │
├────────────────────────────────────────────┤
│ 求人を追加                                  │
│ ┌──────────────────────────┐ [検索]        │
│ │ 求人ID or タイトル or 施設名 │              │
│ └──────────────────────────┘              │
│                                            │
│ 検索結果:                                   │
│ ┌──────────────────────────── [+追加] ──┐  │
│ │ #34 看護師募集 / さくら介護施設          │  │
│ └──────────────────────────────────────┘  │
├────────────────────────────────────────────┤
│ 登録済み求人（3/20）                         │
│                                            │
│ ≡ 1. #34 看護師募集 / さくら介護施設  [🗑]  │
│ ≡ 2. #56 介護士募集 / みどり病院     [🗑]  │
│ ≡ 3. #78 PT募集 / ひまわり施設       [🗑]  │
│                                            │
│ （ドラッグ&ドロップで並び替え可能）           │
│                                            │
│        [ 保存する ]                         │
└────────────────────────────────────────────┘
```

**機能**:
- 求人検索: `GET /api/recommended-jobs?search=xxx` で検索
- 追加: 検索結果から「+追加」ボタンでローカルstateに追加
- 並び替え: HTML5 Drag and Drop API（外部ライブラリ不要）
- 削除: 個別削除ボタン
- 保存: `PUT /api/recommended-jobs` に `jobIds[]` を送信
- 未保存状態の表示: 変更があれば「未保存の変更があります」と表示
- 既存の管理画面スタイルに合わせる（Tailwind CSS）

**スタイル参考**: `/system-admin/lp/guide/page.tsx` と同じ白背景カード＋border-slate-200

**ヘッダー**:
```tsx
<Link href="/system-admin/lp" className="...">
  <ArrowLeft /> LP管理に戻る
</Link>
```

---

### Step 4: LP管理画面に導線ボタン追加

**ファイル**: `app/system-admin/lp/components/DBLPList.tsx`

**変更箇所**: 841行目付近のヘッダーボタン群（`<div className="flex items-center gap-2">`内）

**追加内容**: 「新規LP追加」ボタンの前に以下のボタンを追加:

```tsx
<Link
  href="/system-admin/lp/recommended-jobs"
  className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-md hover:bg-amber-200 transition-colors flex items-center gap-1.5"
>
  <Star className="w-3.5 h-3.5" />
  おすすめ求人管理
</Link>
```

**import追加**: `Star` を `lucide-react` から追加。`Link` を `next/link` から追加（未importの場合）。

---

### Step 5: ウィジェット用公開API

**ファイル**: `app/api/public/recommended-jobs/route.ts`（新規作成）

**認証**: 不要（公開API）

**GET**: おすすめ求人データ取得

**クエリパラメータ**: `?dateIndex=3`（デフォルト=3）

**処理フロー**:
1. `RecommendedJob` テーブルから `sort_order` 順に全件取得（最大20件）
2. 関連する `Job` + `facility` + `workDates` をinclude
3. 日付リスト生成: `generateDatesFromBase(new Date(), 90)` を使用（`utils/date.ts`）
4. `dateIndex` に対応する日付を取得
5. 各求人の `workDates` をフィルタ:
   - 選択日（dateIndexの日付）に一致する `work_date` がある求人のみ返却
   - ただし選択日にwork_dateがない求人もカードとして返却する（応募不可表示）
6. 求人データを既存の `/api/jobs` と同じ `Job` 型（`types/job.ts`）形式に変換

**レスポンス形式**:
```json
{
  "jobs": [
    {
      "id": 34,
      "facilityId": 1,
      "status": "published",
      "title": "...",
      "workDate": "2026-02-15",
      "startTime": "09:00",
      "endTime": "17:00",
      "wage": 15000,
      "hourlyWage": 2000,
      "deadline": "...",
      "tags": [...],
      "address": "...",
      "recruitmentCount": 3,
      "appliedCount": 1,
      "images": [...],
      ...
    }
  ],
  "facilities": [
    {
      "id": 1,
      "name": "...",
      "rating": 4.5,
      "reviewCount": 12,
      ...
    }
  ],
  "dates": ["2026-02-11T15:00:00.000Z", ...],
  "selectedDateIndex": 3
}
```

**求人データ変換（重要）**: Prismaのsnake_caseからフロントエンドのcamelCaseへの変換が必要。
`/api/jobs/route.ts` の変換ロジックを参考にする（既存のgetJobsListWithPaginationの戻り値形式に合わせる）。

**Facility型**: `types/facility.ts` の `Facility` インターフェースに合わせる:
```typescript
{
  id: number;
  name: string;       // facility_name
  rating: number;     // average_rating
  reviewCount: number; // review_count
}
```

---

### Step 6: WidgetJobCardコンポーネント

**ファイル**: `components/job/WidgetJobCard.tsx`（新規作成）

**目的**: iframe内で使用するJobCard。既存の `components/job/JobCard.tsx` と同じ見た目だが、以下が異なる:
- `<Link>` の代わりに `<a href="..." target="_top">` を使用（親ウィンドウで遷移）
- ブックマーク機能なし（常にisPublic=true相当）
- `memo` でラップ

**propsインターフェース**:
```typescript
interface WidgetJobCardProps {
  job: Job & {
    workDates?: Array<{
      id: number;
      workDate: string;
      canApply?: boolean;
      isFull?: boolean;
    }>;
  };
  facility: Facility;
  selectedDate?: string;
}
```

**実装**: 既存の `JobCard.tsx` のモバイル版レイアウト（236〜356行目）をベースにコピーし、以下を変更:
1. `<Link href={...}>` → `<a href={...} target="_top">`
2. ブックマーク関連のstate/ロジックを削除
3. `isPublic` は常にtrue
4. PC版レイアウトは不要（LPはモバイル幅なので）→ PC版も一応入れる（iframe幅がmaxw-lgなので）

**インポート**: `Job` from `@/types/job`, `Facility` from `@/types/facility`, `Badge` from `@/components/ui/badge`, `Image` from `next/image`, `getDeadlineText`, `isDeadlineUrgent` from `@/utils/date`

---

### Step 7: ウィジェットNext.jsページ

**ファイル（2つ）**:

#### 7-1: `app/lp/jobs-widget/layout.tsx`（新規作成）

```tsx
import '@/app/globals.css';

export const metadata = { title: 'おすすめ求人' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-transparent">{children}</body>
    </html>
  );
}
```

#### 7-2: `app/lp/jobs-widget/page.tsx`（新規作成）

**'use client' コンポーネント**

**処理フロー**:
1. stateで `dateIndex`（デフォルト3）を管理
2. `useEffect` で `/api/public/recommended-jobs?dateIndex=${dateIndex}` をfetch
3. `DateSlider`（`components/job/DateSlider.tsx`）を表示
   - `dates`: APIレスポンスの `dates` を `Date[]` に変換
   - `selectedIndex`: dateIndex
   - `onSelect`: dateIndexを更新して再fetch
4. `WidgetJobCard` で各求人を表示
   - グリッドレイアウト: `grid grid-cols-2 gap-3`（LPはモバイル幅想定）
5. 求人が0件の場合: 「選択した日付に勤務可能な求人はありません」と表示
6. ローディング中: スケルトン表示

**ResizeObserver（高さ自動調整）**:
```typescript
useEffect(() => {
  const observer = new ResizeObserver(() => {
    window.parent.postMessage(
      { type: 'tastas-jobs-resize', height: document.body.scrollHeight },
      '*'
    );
  });
  observer.observe(document.body);
  return () => observer.disconnect();
}, []);
```

**スタイル**: `max-w-lg mx-auto p-4`（LP幅に合わせる）

---

### Step 8: ウィジェットローダーJS

**ファイル**: `public/lp/jobs-widget-loader.js`（新規作成）

```javascript
(function() {
  var container = document.querySelector('[data-tastas-jobs]');
  if (!container) return;

  var iframe = document.createElement('iframe');
  iframe.src = '/lp/jobs-widget';
  iframe.style.cssText = 'width:100%;border:none;min-height:400px;overflow:hidden;';
  iframe.setAttribute('scrolling', 'no');

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'tastas-jobs-resize') {
      iframe.style.height = e.data.height + 'px';
    }
  });

  container.appendChild(iframe);
})();
```

---

### Step 9: lp-actions.tsにローダー自動挿入追加

**ファイル**: `lib/lp-actions.ts`

**変更箇所**: `insertTagsToHtml` 関数内（83〜143行目）

`tracking.js` 挿入の後（120行目の `</body>` 置換の後、`hasFooterLinks` の前の123行目付近）に追加:

```typescript
// jobs-widget-loader.jsを挿入（なければ）
const JOBS_WIDGET_SNIPPET = `<script src="/lp/jobs-widget-loader.js"></script>`;
const hasJobsWidget = /jobs-widget-loader\.js/i.test(modifiedHtml);
if (!hasJobsWidget) {
  modifiedHtml = modifiedHtml.replace(/<\/body>/i, `${JOBS_WIDGET_SNIPPET}\n</body>`);
}
```

**返却値の変更は不要**: `hasGtm`, `hasLineTag`, `hasTracking` に `hasJobsWidget` を追加する必要はない（ウィジェットの有無は警告表示に関係しないため）。

---

### Step 10: middleware.tsに除外パス追加

**ファイル**: `middleware.ts`

**変更**: 不要。

`/lp` はすでに `publicPaths` に含まれている（51行目: `'/lp'`）ため、`/lp/jobs-widget` は自動的に認証除外される。

ただし、`/api/public/recommended-jobs` が認証不要であることを確認:
- `/public` は `publicPaths` に含まれている（48行目）
- しかしこれはページ用パスで、APIパスは別。
- `/api/jobs` は `ignoredPaths` に含まれている（63行目）

→ **必要な変更**: `ignoredPaths` に `/api/public` を追加:
```typescript
'/api/public', // 公開API（おすすめ求人など）
```

---

### Step 11: ビルド確認

```bash
npm run build
```

TypeScriptエラーがないことを確認。

---

## ファイル一覧

| # | ファイル | 操作 | 内容 |
|---|---------|------|------|
| 1 | `prisma/schema.prisma` | 変更 | RecommendedJobモデル追加、Jobリレーション追加 |
| 2 | `app/api/recommended-jobs/route.ts` | **新規** | おすすめ求人管理API（GET/PUT） |
| 3 | `app/system-admin/lp/recommended-jobs/page.tsx` | **新規** | おすすめ求人管理画面 |
| 4 | `app/system-admin/lp/components/DBLPList.tsx` | 変更 | おすすめ求人管理ボタン追加 |
| 5 | `app/api/public/recommended-jobs/route.ts` | **新規** | ウィジェット用公開API |
| 6 | `components/job/WidgetJobCard.tsx` | **新規** | iframe対応の軽量JobCard |
| 7 | `app/lp/jobs-widget/layout.tsx` | **新規** | 最小限レイアウト |
| 8 | `app/lp/jobs-widget/page.tsx` | **新規** | ウィジェットページ |
| 9 | `public/lp/jobs-widget-loader.js` | **新規** | LP HTML用ウィジェットローダー |
| 10 | `lib/lp-actions.ts` | 変更 | jobs-widget-loader.jsの自動挿入追加 |
| 11 | `middleware.ts` | 変更 | `/api/public` をignoredPathsに追加 |

---

## 検証チェックリスト

- [ ] `/system-admin/lp/recommended-jobs` で求人を検索・追加・並び替え・保存できる
- [ ] `/api/public/recommended-jobs?dateIndex=3` が認証なしで求人データを返す
- [ ] `/lp/jobs-widget` が単独でアクセスでき、日付選択と求人カードが表示される
- [ ] LP HTML内に `<div data-tastas-jobs></div>` を配置 → その位置にiframeが生成される
- [ ] iframe内の求人カードをクリック → 親ウィンドウで `/public/jobs/[id]` に遷移
- [ ] 日付選択を変更 → 選択日に勤務可能な求人のみ表示される
- [ ] デフォルト日付が3日後（index=3）になっている
- [ ] LP管理画面の右上に「おすすめ求人管理」ボタンが表示される

---

## 既存コード参照情報

### JobCard.tsx の構造（components/job/JobCard.tsx）
- Props: `{ job, facility, selectedDate, priority, isPublic, basePath }`
- `isPublic=true` でブックマーク非表示
- モバイル版: 236〜356行目（`<div className="md:hidden ...">` 内）
- PC版: 117〜233行目（`<div className="hidden md:flex">` 内）
- 全体を `<Link href={jobDetailUrl}>` で囲んでいる → WidgetJobCardでは `<a target="_top">` に変更

### DateSlider.tsx の構造（components/job/DateSlider.tsx）
- Props: `{ dates: Date[], selectedIndex: number, onSelect: (index) => void, onHover? }`
- 「今日」ボタン + 横スクロール日付ボタン
- `generateDates()` で日付配列を作成（`utils/date.ts`）

### Job型（types/job.ts）
- フロントエンド用の型定義（camelCase）
- 主要フィールド: id, title, status, wage, hourlyWage, startTime, endTime, deadline, tags, images, address, access, recruitmentCount, appliedCount

### Facility型（types/facility.ts）
- フロントエンド用: id, name, rating, reviewCount

### DBのJobモデル（prisma/schema.prisma 290行目）
- snake_case
- リレーション: facility, workDates, bookmarks等
- 384行目で `@@map("jobs")` 終了

### middleware.ts
- `publicPaths`（36行目）: `/lp` を含む → `/lp/jobs-widget` は自動除外
- `ignoredPaths`（55行目）: API用の除外パス → `/api/public` を追加する

### lp-actions.ts の insertTagsToHtml（83行目）
- GTM挿入 → LINE CTA data-cats挿入 → tracking.js挿入 → フッターリンク挿入
- tracking.js挿入は120行目（`</body>` 直前）
- ここにjobs-widget-loader.jsの挿入を追加（120行目の後）

### DBLPList.tsx のヘッダーボタン（841行目付近）
- タグ再チェック → 更新 → 新規LP追加 の並び
- おすすめ求人管理ボタンを「新規LP追加」の前に追加
