# 無料LLM指示書: プレビュー機能統一（案B実装）

## 目的
求人プレビューモーダルを廃止し、実際のワーカー向け求人詳細ページ(`/jobs/[id]`)をプレビューモードで表示する。これにより、プレビューと実画面の乖離を完全に解消する。

## 作業概要
1. `JobDetailClient.tsx`にプレビューモード機能を追加
2. 求人詳細ページ(`/jobs/[id]/page.tsx`)でプレビューパラメータを処理
3. 求人作成/編集画面からプレビューページへのリンクを変更
4. `JobPreviewModal.tsx`を廃止

---

## STEP 1: JobDetailClientにプレビューモード追加

### ファイル: `components/job/JobDetailClient.tsx`

**変更1: propsにプレビューモード関連を追加**

```typescript
// 既存のprops定義に追加（17行目付近）
interface JobDetailClientProps {
  job: any;
  facility: any;
  relatedJobs: any[];
  facilityReviews: any[];
  initialHasApplied: boolean;
  initialAppliedWorkDateIds?: number[];
  selectedDate?: string;
  // ↓追加
  isPreviewMode?: boolean;       // プレビューモードフラグ
  onClosePreview?: () => void;   // プレビューを閉じるコールバック
  editUrl?: string;              // 編集画面へのURL
}
```

**変更2: コンポーネント内でプレビューモードを処理**

```typescript
export function JobDetailClient({
  job,
  facility,
  relatedJobs,
  facilityReviews,
  initialHasApplied,
  initialAppliedWorkDateIds = [],
  selectedDate,
  isPreviewMode = false,  // 追加
  onClosePreview,         // 追加
  editUrl,                // 追加
}: JobDetailClientProps) {
```

**変更3: プレビューモード時のヘッダーバナー追加**

コンポーネントの最上部（returnの直後）に追加:

```typescript
return (
  <>
    {/* プレビューモードバナー */}
    {isPreviewMode && (
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white py-3 px-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <span className="font-bold">プレビューモード</span>
          <span className="text-sm opacity-90">ワーカーに表示される画面です</span>
        </div>
        <div className="flex gap-2">
          {editUrl && (
            <a
              href={editUrl}
              className="px-4 py-1.5 bg-white text-amber-600 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors"
            >
              編集する
            </a>
          )}
          {onClosePreview && (
            <button
              onClick={onClosePreview}
              className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              閉じる
            </button>
          )}
        </div>
      </div>
    )}

    {/* プレビューモード時は上部にパディングを追加 */}
    <div className={isPreviewMode ? 'pt-14' : ''}>
      {/* 既存のコンテンツ */}
```

**変更4: プレビューモード時は応募ボタンを非表示**

応募ボタン部分（画面下部のフッター）を条件分岐:

```typescript
{/* 応募ボタン - プレビューモード時は非表示 */}
{!isPreviewMode && (
  <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
    {/* 既存の応募ボタンUI */}
  </div>
)}
```

**変更5: プレビューモード時はお気に入り・ブックマーク機能を無効化**

```typescript
// お気に入りボタンのonClick
onClick={isPreviewMode ? undefined : handleToggleFavorite}
disabled={isPreviewMode}

// ブックマークボタンも同様
```

---

## STEP 2: 求人詳細ページでプレビューパラメータ処理

### ファイル: `app/jobs/[id]/page.tsx`

**変更内容**: URLパラメータ`preview=true`を検出してプレビューモードで表示

```typescript
// 既存のインポートに追加
import { redirect } from 'next/navigation';

// ページコンポーネント内
export default async function JobDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const jobId = parseInt(params.id, 10);
  const isPreviewMode = searchParams.preview === 'true';
  const facilityId = searchParams.facilityId as string | undefined;

  // 求人データ取得
  const job = await getJobById(jobId);

  if (!job) {
    redirect('/jobs');
  }

  // プレビューモード時は期限切れでも表示
  // 通常モード時は期限切れならリダイレクト
  if (!isPreviewMode && job.status !== 'ACTIVE') {
    redirect('/jobs');
  }

  // ... 既存のデータ取得処理 ...

  // 編集URLの生成（プレビューモード時のみ）
  const editUrl = isPreviewMode && facilityId
    ? `/admin/jobs/${jobId}/edit`
    : undefined;

  return (
    <JobDetailClient
      job={job}
      facility={facility}
      relatedJobs={relatedJobs}
      facilityReviews={facilityReviews}
      initialHasApplied={hasApplied}
      initialAppliedWorkDateIds={appliedWorkDateIds}
      isPreviewMode={isPreviewMode}
      editUrl={editUrl}
    />
  );
}
```

---

## STEP 3: 求人作成/編集画面からプレビューへのリンク変更

### 3-1. `app/admin/jobs/new/page.tsx`

**変更内容**: プレビューボタンを新しい方式に変更

```typescript
// 既存のJobPreviewModalインポートを削除
// import { JobPreviewModal } from '@/components/admin/JobPreviewModal';

// プレビューボタンのonClickを変更
const handlePreview = () => {
  // 一時保存してからプレビューページへ遷移
  // または新しいタブでプレビューを開く

  // 方法1: 作成中の求人を一時保存してプレビュー（推奨）
  // この場合、下書き保存機能が必要

  // 方法2: 既存の求人のみプレビュー可能にする
  toast('プレビューは求人保存後に利用できます', { icon: 'ℹ️' });
};

// または、編集画面からのみプレビュー可能にする
// 新規作成時はプレビューボタンを非表示
{jobId && (
  <button
    type="button"
    onClick={() => window.open(`/jobs/${jobId}?preview=true&facilityId=${facilityId}`, '_blank')}
    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
  >
    プレビュー
  </button>
)}
```

### 3-2. `app/admin/jobs/[id]/edit/page.tsx`

**変更内容**: プレビューボタンを新しいタブで開く方式に変更

```typescript
// 既存のJobPreviewModalインポートを削除
// import { JobPreviewModal } from '@/components/admin/JobPreviewModal';

// プレビューモーダル関連のstate削除
// const [showPreview, setShowPreview] = useState(false);

// プレビューボタンの変更
<button
  type="button"
  onClick={() => window.open(`/jobs/${jobId}?preview=true&facilityId=${facilityId}`, '_blank')}
  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
>
  プレビュー
</button>

// JobPreviewModalコンポーネントの呼び出しを削除
// {showPreview && <JobPreviewModal ... />}
```

### 3-3. テンプレート画面も同様に修正
- `app/admin/jobs/templates/new/page.tsx`
- `app/admin/jobs/templates/[id]/edit/page.tsx`

テンプレートの場合は実際の求人ではないため、プレビュー機能は別途検討が必要。
一旦、テンプレート画面ではプレビューボタンを削除または「求人作成後にプレビュー可能」と表示。

---

## STEP 4: JobPreviewModalの廃止

### ファイル: `components/admin/JobPreviewModal.tsx`

**対応**: ファイルを削除

```bash
rm components/admin/JobPreviewModal.tsx
```

**注意**: 削除前に、他のファイルでインポートされていないか確認

```bash
grep -r "JobPreviewModal" --include="*.tsx" --include="*.ts"
```

インポートしているファイルがあれば、すべて削除してから本ファイルを削除。

---

## STEP 5: システム管理画面の求人プレビュー対応

### ファイル: `app/system-admin/jobs/page.tsx`

求人一覧のアクションボタンにプレビューリンクを追加:

```typescript
// アクションボタン部分
<div className="flex gap-2">
  {/* プレビューボタン */}
  <a
    href={`/jobs/${job.id}?preview=true`}
    target="_blank"
    rel="noopener noreferrer"
    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
    title="プレビュー"
  >
    <Eye className="w-4 h-4" />
  </a>

  {/* 編集ボタン（マスカレードログイン） */}
  <button
    onClick={() => handleMasqueradeEdit(job)}
    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
    title="編集"
  >
    <Pencil className="w-4 h-4" />
  </button>
</div>
```

---

## 作業完了後チェックリスト（必須）

### 1. TypeScriptエラーチェック
```bash
npm run build
```
エラーがあれば修正してから次へ進む。

### 2. キャッシュクリアと再ビルド
```bash
rm -rf .next && npm run build
```

### 3. 開発サーバー再起動
```bash
rm -rf .next && npm run dev
```

### 4. 動作確認

- [ ] `/jobs/[id]?preview=true` でプレビューバナーが表示される
- [ ] プレビューモード時、応募ボタンが非表示
- [ ] プレビューモード時、お気に入り・ブックマークが無効
- [ ] 期限切れ求人も`preview=true`で表示される
- [ ] 求人編集画面からプレビューボタンで新しいタブが開く
- [ ] システム管理の求人一覧からプレビューが開ける
- [ ] `JobPreviewModal.tsx`が削除されている
- [ ] ビルドエラーがない

### 5. 変更ファイルの報告
変更したファイル一覧を報告すること。

---

## 注意事項

1. **新規作成時のプレビュー**: 新規作成中はまだ求人IDがないため、プレビューできない。編集画面からのみプレビュー可能とする。

2. **セキュリティ**: `preview=true`パラメータは誰でも付けられるが、プレビューモードでは応募などの操作ができないため問題ない。

3. **テンプレートのプレビュー**: テンプレートは実際の求人ではないため、プレビュー機能は対象外。将来的に「このテンプレートで求人を作成した場合のプレビュー」機能を検討可能。
