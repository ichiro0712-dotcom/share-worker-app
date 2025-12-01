# ワーカーレビュー機能 改修タスク指示書

## 概要
施設がワーカーを評価するレビュー機能を新規作成・改修するタスクです。

---

## タスク一覧

### タスク1: データベーススキーマの変更
### タスク2: 評価項目の変更（ワーカー詳細ページ）
### タスク3: ワーカーレビューページの新規作成
### タスク4: サイドメニューにリンク追加
### タスク5: ワーカー一覧UIの改善
### タスク6: ワーカーマイページにレビュー一覧追加

---

## タスク1: データベーススキーマの変更

### 目的
評価を5項目（勤怠・時間、スキル、遂行力、コミュ力、姿勢）で個別記録できるようにする

### 変更ファイル
`prisma/schema.prisma`

### 変更内容

#### 1-1. Reviewモデルに評価項目フィールドを追加

```prisma
model Review {
  id              Int          @id @default(autoincrement())
  facility_id     Int          @map("facility_id")
  user_id         Int          @map("user_id")
  work_date_id    Int          @map("work_date_id")
  application_id  Int          @map("application_id")
  reviewer_type   ReviewerType @map("reviewer_type")
  rating          Int          // 1-5 (総合評価 - 各項目の平均から算出)

  // === 新規追加: 5項目の個別評価（施設→ワーカー評価時のみ使用） ===
  rating_attendance   Int?     @map("rating_attendance")   // 勤怠・時間
  rating_skill        Int?     @map("rating_skill")        // スキル
  rating_execution    Int?     @map("rating_execution")    // 遂行力
  rating_communication Int?    @map("rating_communication") // コミュ力
  rating_attitude     Int?     @map("rating_attitude")     // 姿勢
  // === 新規追加ここまで ===

  good_points     String?      @db.Text @map("good_points")
  improvements    String?      @db.Text
  created_at      DateTime     @default(now()) @map("created_at")
  updated_at      DateTime     @updatedAt @map("updated_at")

  facility    Facility    @relation(fields: [facility_id], references: [id], onDelete: Cascade)
  user        User        @relation(fields: [user_id], references: [id], onDelete: Cascade)
  workDate    JobWorkDate @relation(fields: [work_date_id], references: [id], onDelete: Cascade)
  application Application @relation(fields: [application_id], references: [id], onDelete: Cascade)

  @@map("reviews")
}
```

#### 1-2. レビューテンプレートモデルを新規追加

```prisma
// ========================================
// レビューコメントテンプレート（施設ごと）
// ========================================

model ReviewTemplate {
  id           Int      @id @default(autoincrement())
  facility_id  Int      @map("facility_id")
  name         String   // テンプレート名
  content      String   @db.Text // テンプレート内容
  created_at   DateTime @default(now()) @map("created_at")
  updated_at   DateTime @updatedAt @map("updated_at")

  facility Facility @relation(fields: [facility_id], references: [id], onDelete: Cascade)

  @@map("review_templates")
}
```

#### 1-3. Facilityモデルにリレーション追加

Facilityモデルに以下を追加：
```prisma
reviewTemplates  ReviewTemplate[]
```

### 実行コマンド
```bash
npx prisma db push
npx prisma generate
```

---

## タスク2: 評価項目の変更（ワーカー詳細ページ）

### 目的
`/admin/workers/[id]` ページの評価項目を新しい5項目に変更

### 変更ファイル
`app/admin/workers/[id]/page.tsx`

### 変更内容

#### 2-1. 評価項目の表示を変更

**変更前（526-543行目付近）:**
```tsx
{[
  { label: '時間厳守', score: 4.9 },
  { label: '業務遂行', score: 4.5 },
  { label: '態度', score: 4.9 },
  { label: 'コミュ力', score: 4.2 },
].map((item, i) => (
```

**変更後:**
```tsx
{[
  { label: '勤怠・時間', key: 'attendance' },
  { label: 'スキル', key: 'skill' },
  { label: '遂行力', key: 'execution' },
  { label: 'コミュ力', key: 'communication' },
  { label: '姿勢', key: 'attitude' },
].map((item, i) => (
  <div key={i} className="space-y-1">
    <div className="flex justify-between items-center text-xs">
      <span className="text-gray-600">{item.label}</span>
      <span className="font-bold text-gray-900">
        {worker.ratingsByCategory?.[item.key]?.toFixed(1) || '-'}
      </span>
    </div>
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-yellow-400"
        style={{ width: `${(worker.ratingsByCategory?.[item.key] || 0) * 20}%` }}
      />
    </div>
  </div>
))}
```

#### 2-2. WorkerDetailDataインターフェースに追加

```tsx
interface WorkerDetailData {
  // ... 既存フィールド ...

  // 項目別平均評価（新規追加）
  ratingsByCategory: {
    attendance: number | null;
    skill: number | null;
    execution: number | null;
    communication: number | null;
    attitude: number | null;
  } | null;
}
```

---

## タスク3: ワーカーレビューページの新規作成

### 目的
施設管理者がワーカーへのレビューを管理・入力できるページを作成

### 作成ファイル
`app/admin/worker-reviews/page.tsx`

### UI仕様

#### 3-1. ページヘッダー
- タイトル: 「ワーカーレビュー」
- サブタイトル: 「ワーカーへの評価を管理します」

#### 3-2. タブ切り替え
- 「未入力」タブ: 始業開始日を過ぎたがレビュー未入力の応募一覧
- 「入力済み」タブ: レビュー入力済みの一覧

#### 3-3. 未入力一覧の表示
各カードに表示する情報:
- ワーカー名、プロフィール画像
- 勤務日、勤務時間
- 求人タイトル
- 「レビューを入力」ボタン
- **重要**: 始業開始日から3日以上経過している場合は赤い警告表示

#### 3-4. レビュー入力モーダル

**評価入力セクション:**
```
注意書き: 「減点採点になります。問題点がない場合は5点を記載」

勤怠・時間: ★★★★★ (1-5)
説明: 始業・休憩・終業等の時間をきちんと守れていましたか？

スキル: ★★★★★ (1-5)
説明: 業務に関わる技術はもちあわせていましたか？

遂行力: ★★★★★ (1-5)
説明: 必要な業務を遂行できましたか？

コミュ力: ★★★★★ (1-5)
説明: 業務上必要なコミュニケーションレベルに達していましたか？

姿勢: ★★★★★ (1-5)
説明: 不適切な態度などなく業務を遂行できましたか？
```

**コメント入力セクション:**
- テキストエリア（placeholder: 「良かった点などを具体的に記入すると、また働きたいと思われてもらいやすいです」）
- 「テンプレートから選択」ドロップダウン
- 「テンプレート編集」ボタン（別モーダルでテンプレートCRUD）

**アクションボタン（4つ横並び）:**
1. 「レビュー登録」- レビューのみ保存
2. 「レビュー登録後お気に入り」- レビュー保存 + お気に入り追加
3. 「レビュー登録後ブロック」- レビュー保存 + ブロック追加
4. 「キャンセル」- モーダルを閉じる

#### 3-5. テンプレート編集モーダル
- テンプレート一覧表示
- 新規作成ボタン
- 各テンプレートに編集・削除ボタン
- テンプレート名とコメント内容を入力

### ページコード骨格

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Star, AlertTriangle, Clock, FileText, Heart, Ban, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

// 評価項目の定義
const RATING_CATEGORIES = [
  { key: 'attendance', label: '勤怠・時間', description: '始業・休憩・終業等の時間をきちんと守れていましたか？' },
  { key: 'skill', label: 'スキル', description: '業務に関わる技術はもちあわせていましたか？' },
  { key: 'execution', label: '遂行力', description: '必要な業務を遂行できましたか？' },
  { key: 'communication', label: 'コミュ力', description: '業務上必要なコミュニケーションレベルに達していましたか？' },
  { key: 'attitude', label: '姿勢', description: '不適切な態度などなく業務を遂行できましたか？' },
];

interface PendingReview {
  applicationId: number;
  userId: number;
  userName: string;
  userProfileImage: string | null;
  jobTitle: string;
  workDate: string;
  startTime: string;
  endTime: string;
  daysSinceWork: number; // 勤務日からの経過日数
}

interface ReviewTemplate {
  id: number;
  name: string;
  content: string;
}

export default function WorkerReviewsPage() {
  const router = useRouter();
  const { admin, isAdmin, isAdminLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [completedReviews, setCompletedReviews] = useState<any[]>([]);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // モーダル状態
  const [selectedApplication, setSelectedApplication] = useState<PendingReview | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // 評価入力状態
  const [ratings, setRatings] = useState({
    attendance: 5,
    skill: 5,
    execution: 5,
    communication: 5,
    attitude: 5,
  });
  const [comment, setComment] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  // 認証チェック
  useEffect(() => {
    if (isAdminLoading) return;
    if (!isAdmin || !admin) {
      router.push('/admin/login');
    }
  }, [isAdmin, admin, isAdminLoading, router]);

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      if (!admin?.facilityId) return;
      setIsLoading(true);
      try {
        // TODO: API実装後に接続
        // const pending = await getPendingWorkerReviews(admin.facilityId);
        // const completed = await getCompletedWorkerReviews(admin.facilityId);
        // const templates = await getReviewTemplates(admin.facilityId);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [admin?.facilityId]);

  // レビュー投稿
  const handleSubmitReview = async (action: 'submit' | 'favorite' | 'block') => {
    if (!selectedApplication || !admin) return;

    try {
      // TODO: API実装
      // await submitWorkerReview({
      //   applicationId: selectedApplication.applicationId,
      //   facilityId: admin.facilityId,
      //   ratings,
      //   comment,
      //   action, // 'favorite' or 'block' の場合は追加処理
      // });

      toast.success('レビューを登録しました');
      setSelectedApplication(null);
      // リストを更新
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error('レビューの登録に失敗しました');
    }
  };

  // 星評価コンポーネント
  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              star <= value ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );

  if (!isAdmin || !admin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <h1 className="text-xl font-bold">ワーカーレビュー</h1>
          <p className="text-sm text-gray-600 mt-1">ワーカーへの評価を管理します</p>
        </div>

        {/* タブ */}
        <div className="px-6 flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            未入力 ({pendingReviews.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'completed'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            入力済み ({completedReviews.length})
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-6">
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {pendingReviews.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">未入力のレビューはありません</p>
              </div>
            ) : (
              pendingReviews.map((review) => (
                <div
                  key={review.applicationId}
                  className={`bg-white rounded-lg border p-4 ${
                    review.daysSinceWork >= 3 ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* プロフィール画像 */}
                      <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                        {review.userProfileImage ? (
                          <img src={review.userProfileImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                            {review.userName.charAt(0)}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{review.userName}</span>
                          {review.daysSinceWork >= 3 && (
                            <span className="flex items-center gap-1 text-red-600 text-xs">
                              <AlertTriangle className="w-3 h-3" />
                              {review.daysSinceWork}日経過
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{review.jobTitle}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(review.workDate).toLocaleDateString('ja-JP')} {review.startTime}-{review.endTime}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedApplication(review)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                    >
                      レビューを入力
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="space-y-4">
            {/* 入力済みレビュー一覧 - 読み取り専用 */}
          </div>
        )}
      </div>

      {/* レビュー入力モーダル */}
      {selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedApplication(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* モーダルヘッダー */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">レビュー入力</h2>
              <button onClick={() => setSelectedApplication(null)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* ワーカー情報 */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  {selectedApplication.userProfileImage ? (
                    <img src={selectedApplication.userProfileImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                      {selectedApplication.userName.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-bold">{selectedApplication.userName}</p>
                  <p className="text-sm text-gray-600">{selectedApplication.jobTitle}</p>
                </div>
              </div>
            </div>

            {/* 評価入力 */}
            <div className="px-6 py-4">
              {/* 注意書き */}
              <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  減点採点になります。問題点がない場合は5点を記載してください。
                </p>
              </div>

              {/* 5項目の評価 */}
              <div className="space-y-6">
                {RATING_CATEGORIES.map((category) => (
                  <div key={category.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{category.label}</span>
                      <StarRating
                        value={ratings[category.key as keyof typeof ratings]}
                        onChange={(v) => setRatings(prev => ({ ...prev, [category.key]: v }))}
                      />
                    </div>
                    <p className="text-xs text-gray-500">{category.description}</p>
                  </div>
                ))}
              </div>

              {/* コメント入力 */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-medium">コメント</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTemplateId || ''}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setSelectedTemplateId(id || null);
                        const template = templates.find(t => t.id === id);
                        if (template) setComment(template.content);
                      }}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="">テンプレートから選択</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <FileText className="w-4 h-4" />
                      編集
                    </button>
                  </div>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="良かった点などを具体的に記入すると、また働きたいと思われてもらいやすいです"
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* アクションボタン */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => handleSubmitReview('submit')}
                  className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  レビュー登録
                </button>
                <button
                  onClick={() => handleSubmitReview('favorite')}
                  className="px-3 py-2 bg-pink-600 text-white text-sm font-medium rounded-lg hover:bg-pink-700 flex items-center justify-center gap-1"
                >
                  <Heart className="w-4 h-4" />
                  お気に入り
                </button>
                <button
                  onClick={() => handleSubmitReview('block')}
                  className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 flex items-center justify-center gap-1"
                >
                  <Ban className="w-4 h-4" />
                  ブロック
                </button>
                <button
                  onClick={() => setSelectedApplication(null)}
                  className="px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* テンプレート編集モーダル */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowTemplateModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold">テンプレート編集</h2>
              <button onClick={() => setShowTemplateModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              {/* テンプレート一覧・編集フォーム */}
              <p className="text-sm text-gray-600">テンプレートの作成・編集機能</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## タスク4: サイドメニューにリンク追加

### 変更ファイル
`components/admin/AdminLayout.tsx`

### 変更内容

menuItems配列の「ワーカー管理」の後に追加:

```tsx
{
  title: 'ワーカーレビュー',
  icon: <Star className="w-4 h-4" />,
  href: '/admin/worker-reviews',
  active: pathname?.startsWith('/admin/worker-reviews'),
  isSubItem: true, // ワーカー管理の下の階層
},
```

**変更後のmenuItems（該当部分）:**
```tsx
{
  title: 'ワーカー管理',
  icon: <Users className="w-4 h-4" />,
  href: '/admin/workers',
  active: pathname?.startsWith('/admin/workers') && !pathname?.startsWith('/admin/worker-reviews'),
},
{
  title: 'ワーカーレビュー',
  icon: <Star className="w-4 h-4" />,
  href: '/admin/worker-reviews',
  active: pathname?.startsWith('/admin/worker-reviews'),
  isSubItem: true,
},
```

---

## タスク5: ワーカー一覧UIの改善

### 変更ファイル
`app/admin/workers/page.tsx`

### 変更内容

#### 5-1. ステータス表示を三角リボンに変更（既に実装済み - 確認のみ）

現在のコードで既に三角リボンデザインになっています（414-438行目）。

#### 5-2. 「キャンセル率」を「直前キャンセル率」に変更（既に実装済み - 確認のみ）

現在のコードで既に「直前キャンセル率」になっています（563-569行目）。

#### 5-3. 「総勤務」列をカード下部に固定

**問題**: カード内の情報量が少ないと、総勤務の列（フッター部分）がカードの下部ではなく上に詰まって表示される。

**現在のコード（574-593行目）:**
フッター部分は `<Link>` の外にあり、flex構造で対応が必要。

**修正方法:**
カード全体を `flex flex-col h-full` にし、コンテンツ部分とフッター部分を分離。

```tsx
<Link
  key={worker.userId}
  href={`/admin/workers/${worker.userId}`}
  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full"
>
  {/* カード本体 - flex-1で残りスペースを占有 */}
  <div className="p-4 flex-1 flex flex-col relative">
    {/* ... 既存のコンテンツ ... */}

    {/* 勤務統計 - mt-auto でカード本体の下部に固定 */}
    <div className="mt-auto pt-3 border-t border-gray-100">
      {/* ... 勤務統計コンテンツ ... */}
    </div>
  </div>

  {/* カードフッター - 常に最下部 */}
  <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
    <span>総勤務 {worker.totalWorkCount}回</span>
    {/* ... */}
  </div>
</Link>
```

**重要**: 既存のコードを確認したところ、この構造は既に実装されています（411行目: `flex flex-col h-full`、549行目: `mt-auto`）。
グリッドの各カードの高さが揃っていない可能性があるため、グリッドコンテナに `grid-rows-[masonry]` ではなく、各アイテムに `h-full` が効いているか確認してください。

---

## タスク6: ワーカーマイページにレビュー一覧追加

### 目的
ワーカーが自分が受けたレビュー（施設からの評価）を確認できるページを追加

### 作成ファイル
`app/mypage/reviews/received/page.tsx`

### UI仕様
- ワーカーマイページのサブメニューに「受けたレビュー」を追加
- 施設からのレビュー一覧表示（読み取り専用）
- 各レビューに: 施設名、勤務日、5項目の評価、コメント

### ページコード骨格

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ReceivedReview {
  id: number;
  facilityName: string;
  jobTitle: string;
  workDate: string;
  rating: number;
  ratings: {
    attendance: number;
    skill: number;
    execution: number;
    communication: number;
    attitude: number;
  };
  comment: string | null;
  createdAt: string;
}

export default function ReceivedReviewsPage() {
  const router = useRouter();
  const { user, isUser, isUserLoading } = useAuth();
  const [reviews, setReviews] = useState<ReceivedReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading) return;
    if (!isUser || !user) {
      router.push('/login');
    }
  }, [isUser, user, isUserLoading, router]);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!user?.id) return;
      setIsLoading(true);
      try {
        // TODO: API実装後に接続
        // const data = await getReceivedReviews(user.id);
        // setReviews(data);
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReviews();
  }, [user?.id]);

  const RATING_LABELS = [
    { key: 'attendance', label: '勤怠・時間' },
    { key: 'skill', label: 'スキル' },
    { key: 'execution', label: '遂行力' },
    { key: 'communication', label: 'コミュ力' },
    { key: 'attitude', label: '姿勢' },
  ];

  if (!isUser || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-6">受けた評価</h1>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">まだ評価を受けていません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-lg border border-gray-200 p-4">
                {/* ヘッダー */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">{review.facilityName}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(review.workDate).toLocaleDateString('ja-JP')}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-3">{review.jobTitle}</p>

                {/* 総合評価 */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl font-bold">{review.rating.toFixed(1)}</span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* 項目別評価 */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {RATING_LABELS.map(({ key, label }) => (
                    <div key={key} className="text-center">
                      <div className="text-xs text-gray-500 mb-1">{label}</div>
                      <div className="font-medium">
                        {review.ratings[key as keyof typeof review.ratings]}
                      </div>
                    </div>
                  ))}
                </div>

                {/* コメント */}
                {review.comment && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700">{review.comment}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## API関数（src/lib/actions.ts に追加）

### 必要なAPI関数一覧

```typescript
// === ワーカーレビュー関連 ===

// 1. 未入力レビュー一覧取得（施設管理者用）
export async function getPendingWorkerReviews(facilityId: number)

// 2. 入力済みレビュー一覧取得（施設管理者用）
export async function getCompletedWorkerReviews(facilityId: number)

// 3. ワーカーレビュー投稿
export async function submitWorkerReview(data: {
  applicationId: number;
  facilityId: number;
  ratings: {
    attendance: number;
    skill: number;
    execution: number;
    communication: number;
    attitude: number;
  };
  comment: string;
  action?: 'favorite' | 'block';
})

// 4. ワーカーが受けたレビュー一覧取得
export async function getReceivedReviews(userId: number)

// 5. ワーカー詳細の項目別平均評価取得（getWorkerDetailを拡張）
// 既存のgetWorkerDetail関数にratingsByCategoryを追加

// === レビューテンプレート関連 ===

// 6. テンプレート一覧取得
export async function getReviewTemplates(facilityId: number)

// 7. テンプレート作成
export async function createReviewTemplate(facilityId: number, name: string, content: string)

// 8. テンプレート更新
export async function updateReviewTemplate(templateId: number, name: string, content: string)

// 9. テンプレート削除
export async function deleteReviewTemplate(templateId: number)
```

---

## 実装順序

1. **タスク1**: DBスキーマ変更 → `npx prisma db push`
2. **タスク4**: サイドメニュー修正（すぐ確認できるように）
3. **タスク3**: ワーカーレビューページ作成
4. **タスク2**: ワーカー詳細ページの評価項目変更
5. **タスク5**: ワーカー一覧UI確認・修正
6. **タスク6**: ワーカーマイページにレビュー一覧追加

---

## 注意事項

1. **一度レビュー登録したら変更不可**: レビュー編集機能は作成しない
2. **始業開始日から入力可能**: `work_date <= 今日` の条件でフィルター
3. **3日以上経過で警告表示**: daysSinceWork >= 3 で赤いハイライト
4. **評価の平均計算**: 5項目の平均をratingフィールドに保存
