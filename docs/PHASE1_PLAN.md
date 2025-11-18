# Phase 1 実装計画

## 実装範囲

### 実装する機能
1. トップページ（求人一覧）
   - 求人カード表示（50件のダミーデータ）
   - タブ切り替え（全体/限定/指名）
   - 日付スライダー
   - 並び順変更（近い順/時給順）
   - 下部ナビゲーション

2. 求人詳細ページ
   - 基本情報表示
   - 画像カルーセル
   - お仕事カード
   - 責任者情報
   - 仕事内容
   - レビュー表示
   - 申し込みボタン

3. 申し込み完了ページ
   - 完了メッセージ
   - TOPに戻るボタン

4. 工事中ページ
   - お気に入り
   - メッセージ
   - 仕事管理
   - マイページ

### 実装しない機能（Phase 2以降）
- ユーザー認証（ログイン/会員登録）
- 実際の応募処理
- フィルター機能の詳細
- ブックマーク保存
- お気に入り保存
- あとで見る保存
- メッセージ機能
- 仕事管理機能
- マイページ機能

## 技術スタック

### フロントエンド
- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **状態管理**: React useState/useContext（Phase 1は軽量で）
- **データフェッチング**: fetch API（Phase 1はダミーデータなので不要）

### バックエンド
- **Phase 1**: バックエンド不要（ダミーデータのみ）
- **Phase 2以降**: Node.js + Express.js + PostgreSQL

### 開発環境
- Node.js 18以上
- npm または yarn

## ディレクトリ構成

```
share-worker-app/
├── docs/                          # ドキュメント（既存）
│   ├── requirements.md
│   ├── screen-specification.md
│   └── PHASE1_PLAN.md
├── mock/                          # モックHTML（既存）
│   ├── top.html
│   ├── job-list.html
│   ├── job-detail.html
│   ├── application-complete.html
│   └── img/
├── src/                           # Next.jsアプリケーション
│   ├── app/                       # App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx              # トップページ
│   │   ├── jobs/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # 求人詳細
│   │   ├── application-complete/
│   │   │   └── page.tsx          # 申し込み完了
│   │   └── under-construction/
│   │       └── page.tsx          # 工事中ページ
│   ├── components/                # コンポーネント
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── BottomNav.tsx
│   │   ├── job/
│   │   │   ├── JobCard.tsx
│   │   │   ├── JobDetail.tsx
│   │   │   ├── DateSlider.tsx
│   │   │   └── ImageCarousel.tsx
│   │   └── ui/                   # 共通UIコンポーネント
│   │       ├── Button.tsx
│   │       ├── Badge.tsx
│   │       └── Tag.tsx
│   ├── data/                      # ダミーデータ
│   │   ├── jobs.ts               # 求人データ（50件）
│   │   ├── facilities.ts         # 施設データ（30件）
│   │   └── reviews.ts            # レビューデータ（100件）
│   ├── types/                     # 型定義
│   │   ├── job.ts
│   │   ├── facility.ts
│   │   └── review.ts
│   └── utils/                     # ユーティリティ
│       └── date.ts
├── public/                        # 静的ファイル
│   └── images/
│       └── placeholder.svg
├── .gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

## データ構造

### JobTemplate（案件テンプレート）
```typescript
interface JobTemplate {
  id: number;
  name: string;              // テンプレート名
  title: string;             // 案件タイトル
  startTime: string;         // HH:MM
  endTime: string;           // HH:MM
  breakTime: number;         // 休憩時間（分）
  hourlyWage: number;        // 時給
  transportationFee: number;
  recruitmentCount: number;  // 募集人数
  qualifications: string[];  // 必要資格
  description: string;       // 仕事内容
  notes: string;             // 備考
  tags: string[];
}
```

**注意**: テンプレートは企業全体で共有され、特定の事業所には紐づかない

### Job（求人）
```typescript
interface Job {
  id: number;
  facilityId: number;
  templateId?: number;       // 使用したテンプレートID（任意）
  title: string;
  workDate: string;          // YYYY-MM-DD
  startTime: string;         // HH:MM
  endTime: string;           // HH:MM
  breakTime: string;         // 例: "12:00-13:00"
  wage: number;              // 日給
  hourlyWage: number;        // 時給
  deadline: string;          // ISO 8601
  tags: string[];
  address: string;
  access: string;
  recruitmentCount: number;  // 募集人数
  appliedCount: number;      // 応募済み人数
  transportationFee: number;
  overview: string;
  workContent: string[];
  requiredQualifications: string[];
  requiredExperience: string[];
  dresscode: string[];
  belongings: string[];
  managerName: string;
  managerMessage: string;
  managerAvatar: string;
  images: string[];
}
```

### Facility（施設）
```typescript
interface Facility {
  id: number;
  name: string;
  type: string;              // デイサービス、特養など
  corporationName: string;
  address: string;
  phoneNumber: string;
  lat: number;
  lng: number;
  rating: number;            // 平均評価
  reviewCount: number;
  image: string;
}
```

### Review（レビュー）
```typescript
interface Review {
  id: number;
  facilityId: number;
  age: string;               // 30代など
  gender: string;            // 男性、女性
  occupation: string;        // 介護福祉士など
  period: string;            // 1ヶ月以内など
  rating: number;            // 1-5
  goodPoints: string;
  improvements: string;
  createdAt: string;
}
```

## 実装ステップ

### Step 1: プロジェクトセットアップ
- [ ] Next.jsプロジェクト作成
- [ ] Tailwind CSS設定
- [ ] ディレクトリ構造作成
- [ ] 型定義ファイル作成

### Step 2: ダミーデータ作成
- [ ] 施設データ（30件）
- [ ] テンプレートデータ（7件）- 企業全体で共有
- [ ] 求人データ（50件）
- [ ] レビューデータ（100件）

### Step 3: 共通コンポーネント作成
- [ ] Button
- [ ] Badge
- [ ] Tag
- [ ] BottomNav
- [ ] Header

### Step 4: トップページ実装
- [ ] ページレイアウト
- [ ] タブ切り替え
- [ ] 日付スライダー
- [ ] 並び順ドロップダウン
- [ ] 求人カード
- [ ] 下部ナビゲーション

### Step 5: 求人詳細ページ実装
- [ ] ページレイアウト
- [ ] ヘッダー（戻るボタン、あとで見る）
- [ ] タブナビゲーション
- [ ] 画像カルーセル
- [ ] 施設情報
- [ ] お仕事カード（横スクロール）
- [ ] 責任者情報
- [ ] 仕事内容
- [ ] レビュー表示
- [ ] 申し込みボタン

### Step 6: その他ページ実装
- [ ] 申し込み完了ページ
- [ ] 工事中ページ

### Step 7: 動作確認・調整
- [ ] 画面遷移確認
- [ ] レスポンシブ確認
- [ ] デザイン調整
- [ ] ダミーデータ確認

## 注意事項

1. **HTMLデザインの継承**
   - 既存のHTMLモックのデザインを忠実に再現
   - 色、フォントサイズ、スペーシングを維持
   - 必要最小限のボタン追加のみ許可

2. **未実装機能の表示**
   - フィルター機能：ボタンのみ、クリックで「未定」表示
   - ブックマーク：アイコンのみ、クリックで「未定」表示
   - お気に入り：アイコンのみ、クリックで「未定」表示
   - あとで見る：ボタンのみ、クリックで「未定」表示

3. **ダミーデータ**
   - リアルな施設名・住所（実在しないもの）
   - 日本の地名を使用
   - 評価・レビューは多様性を持たせる

4. **パフォーマンス**
   - 画像の最適化
   - 不要な再レンダリングを避ける

## 開発開始コマンド

```bash
# プロジェクト作成
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir

# 開発サーバー起動
npm run dev
```

## 完了条件

- [ ] すべてのページが画面仕様書通りに表示される
- [ ] 50件の求人データが表示される
- [ ] 画面遷移が正しく動作する
- [ ] レスポンシブデザインが正しく動作する
- [ ] モックHTMLとほぼ同じデザインになっている
