# +タスタス - システム設計書

> **更新日**: 2025-12-04
> **ステータス**: 実装済みシステムに基づく設計書

---

## 1. システム概要

### 1.1 システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                        クライアント                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   ワーカー    │  │  施設管理者   │  │    管理者    │           │
│  │  (スマホ)    │  │ (タブレット)  │  │   (※未実装)  │           │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘           │
└─────────┼────────────────┼──────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js App Router                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Server Components                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │  │
│  │  │  Pages   │  │ Layouts  │  │Components│                 │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │  │
│  └───────┼─────────────┼─────────────┼───────────────────────┘  │
│          │             │             │                           │
│  ┌───────▼─────────────▼─────────────▼───────────────────────┐  │
│  │                   Server Actions                           │  │
│  │                 (src/lib/actions.ts)                       │  │
│  └────────────────────────┬──────────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Prisma ORM                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL                                  │
│                    (Docker Compose)                              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 主要技術スタック

| カテゴリ | 技術 | バージョン |
|----------|------|-----------|
| フレームワーク | Next.js | 14.x (App Router) |
| 言語 | TypeScript | strict mode |
| スタイリング | Tailwind CSS | 3.x |
| ORM | Prisma | 5.x |
| 認証 | NextAuth.js | 4.x (JWT) |
| データベース | PostgreSQL | 15.x |
| コンテナ | Docker Compose | - |
| アイコン | Lucide React | - |
| 通知UI | React Hot Toast | - |

---

## 2. ディレクトリ構造

```
/
├── app/                      # Next.js App Router
│   ├── layout.tsx           # ルートレイアウト
│   ├── page.tsx             # トップページ
│   ├── admin/               # 施設管理者画面
│   │   ├── layout.tsx       # 管理者レイアウト
│   │   ├── page.tsx         # ダッシュボード
│   │   ├── login/           # ログイン
│   │   ├── jobs/            # 求人管理
│   │   ├── applications/    # 応募管理
│   │   ├── workers/         # ワーカー管理
│   │   ├── messages/        # メッセージ
│   │   └── facility/        # 施設情報
│   ├── jobs/                # 求人一覧
│   ├── mypage/              # マイページ関連
│   ├── messages/            # メッセージ
│   ├── login/               # ログイン
│   └── api/                 # API Routes
│       ├── auth/            # NextAuth API
│       ├── upload/          # ファイルアップロード
│       └── cron/            # 定期処理
│
├── components/              # 共有コンポーネント
│   ├── ui/                  # 汎用UIコンポーネント
│   ├── admin/               # 管理者画面コンポーネント
│   ├── job/                 # 求人関連コンポーネント
│   └── layout/              # レイアウトコンポーネント
│
├── contexts/                # React Context
│   └── AuthContext.tsx      # 認証コンテキスト
│
├── hooks/                   # カスタムフック
│   └── useAdminAuth.ts      # 管理者認証フック
│
├── lib/                     # ユーティリティ
│   ├── auth.ts              # NextAuth設定
│   ├── prisma.ts            # Prismaクライアント
│   └── admin-session.ts     # 管理者セッション
│
├── src/lib/                 # Server Actions
│   └── actions.ts           # 全Server Actions
│
├── prisma/                  # Prisma設定
│   ├── schema.prisma        # スキーマ定義
│   └── seed.ts              # シードデータ
│
├── public/                  # 静的ファイル
│   └── uploads/             # アップロードファイル
│
├── types/                   # 型定義
│   └── *.ts                 # 各種型定義
│
└── docs/                    # ドキュメント
    ├── requirements.md      # 要件定義書
    ├── screen-specification.md  # 画面仕様書
    └── system-design.md     # システム設計書(本ファイル)
```

---

## 3. データベース設計

### 3.1 ER図（概要）

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     User     │       │   Facility   │       │FacilityAdmin │
│   (ワーカー)  │       │    (施設)    │       │ (施設管理者)  │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       │                      │ 1:N                  │ N:1
       │                      ▼                      │
       │              ┌──────────────┐              │
       │              │     Job      │◀─────────────┘
       │ N:1          │    (求人)    │
       └──────────────┤              │
                      └──────┬───────┘
                             │ 1:N
                             ▼
                      ┌──────────────┐
                      │ JobWorkDate  │
                      │  (勤務日)    │
                      └──────┬───────┘
                             │ 1:N
                             ▼
                      ┌──────────────┐
                      │ Application  │
                      │    (応募)    │
                      └──────────────┘
```

### 3.2 主要テーブル定義

#### User（ワーカー）
```sql
users (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR UNIQUE NOT NULL,
  password_hash   VARCHAR NOT NULL,
  name            VARCHAR NOT NULL,
  birth_date      TIMESTAMP,
  phone_number    VARCHAR NOT NULL,
  profile_image   VARCHAR,
  qualifications  TEXT[],

  -- 基本情報
  last_name_kana  VARCHAR,
  first_name_kana VARCHAR,
  gender          VARCHAR,
  nationality     VARCHAR,

  -- 住所
  postal_code     VARCHAR,
  prefecture      VARCHAR,
  city            VARCHAR,
  address_line    VARCHAR,
  building        VARCHAR,

  -- 緊急連絡先
  emergency_name     VARCHAR,
  emergency_relation VARCHAR,
  emergency_phone    VARCHAR,
  emergency_address  VARCHAR,

  -- 就業希望
  current_work_style     VARCHAR,
  desired_work_style     VARCHAR,
  job_change_desire      VARCHAR,
  desired_work_days_week VARCHAR,
  desired_work_period    VARCHAR,
  desired_work_days      TEXT[],
  desired_start_time     VARCHAR,
  desired_end_time       VARCHAR,

  -- 経験
  experience_fields JSON,
  work_histories    TEXT[],

  -- その他
  self_pr        TEXT,
  bank_name      VARCHAR,
  branch_name    VARCHAR,
  account_name   VARCHAR,
  account_number VARCHAR,
  pension_number VARCHAR,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

#### Facility（施設）
```sql
facilities (
  id               SERIAL PRIMARY KEY,
  corporation_name VARCHAR NOT NULL,
  facility_name    VARCHAR NOT NULL,
  facility_type    VARCHAR NOT NULL,
  address          VARCHAR NOT NULL,
  lat              FLOAT NOT NULL,
  lng              FLOAT NOT NULL,
  phone_number     VARCHAR NOT NULL,
  description      TEXT,
  images           TEXT[],
  rating           FLOAT DEFAULT 0,
  review_count     INT DEFAULT 0,
  initial_message  TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

#### Job（求人）
```sql
jobs (
  id                   SERIAL PRIMARY KEY,
  facility_id          INT REFERENCES facilities(id),
  template_id          INT REFERENCES job_templates(id),
  status               job_status DEFAULT 'DRAFT',
  title                VARCHAR NOT NULL,
  start_time           VARCHAR NOT NULL,
  end_time             VARCHAR NOT NULL,
  break_time           VARCHAR NOT NULL,
  wage                 INT NOT NULL,
  hourly_wage          INT NOT NULL,
  transportation_fee   INT NOT NULL,
  deadline_days_before INT DEFAULT 1,
  tags                 TEXT[],
  address              VARCHAR NOT NULL,
  access               VARCHAR NOT NULL,
  recruitment_count    INT NOT NULL,
  overview             TEXT NOT NULL,
  work_content         TEXT[],
  required_qualifications TEXT[],
  required_experience  TEXT[],
  dresscode            TEXT[],
  dresscode_images     TEXT[],
  belongings           TEXT[],
  attachments          TEXT[],
  manager_name         VARCHAR NOT NULL,
  manager_message      TEXT,
  manager_avatar       VARCHAR,
  images               TEXT[],

  -- 通勤方法
  allow_car            BOOLEAN DEFAULT FALSE,
  allow_bike           BOOLEAN DEFAULT FALSE,
  allow_bicycle        BOOLEAN DEFAULT FALSE,
  allow_public_transit BOOLEAN DEFAULT FALSE,
  has_parking          BOOLEAN DEFAULT FALSE,

  -- その他条件
  no_bathing_assist      BOOLEAN DEFAULT FALSE,
  has_driver             BOOLEAN DEFAULT FALSE,
  hair_style_free        BOOLEAN DEFAULT FALSE,
  nail_ok                BOOLEAN DEFAULT FALSE,
  uniform_provided       BOOLEAN DEFAULT FALSE,
  inexperienced_ok       BOOLEAN DEFAULT FALSE,
  beginner_ok            BOOLEAN DEFAULT FALSE,
  facility_within_5years BOOLEAN DEFAULT FALSE,

  -- 定期案件
  weekly_frequency    INT,
  monthly_commitment  BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

#### JobWorkDate（勤務日）
```sql
job_work_dates (
  id                SERIAL PRIMARY KEY,
  job_id            INT REFERENCES jobs(id),
  work_date         TIMESTAMP NOT NULL,
  deadline          TIMESTAMP NOT NULL,
  recruitment_count INT NOT NULL,
  applied_count     INT DEFAULT 0,
  matched_count     INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (job_id, work_date)
)
```

#### Application（応募）
```sql
applications (
  id                     SERIAL PRIMARY KEY,
  work_date_id           INT REFERENCES job_work_dates(id),
  user_id                INT REFERENCES users(id),
  status                 worker_status DEFAULT 'APPLIED',
  worker_review_status   review_status DEFAULT 'PENDING',
  facility_review_status review_status DEFAULT 'PENDING',
  message                TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (work_date_id, user_id)
)
```

### 3.3 Enum定義

```sql
-- 求人ステータス
CREATE TYPE job_status AS ENUM (
  'DRAFT',      -- 下書き
  'PUBLISHED',  -- 公開中
  'STOPPED',    -- 停止中
  'WORKING',    -- 稼働中
  'COMPLETED',  -- 完了
  'CANCELLED'   -- キャンセル
);

-- ワーカーステータス
CREATE TYPE worker_status AS ENUM (
  'APPLIED',           -- 応募中
  'SCHEDULED',         -- 勤務予定
  'WORKING',           -- 稼働中
  'COMPLETED_PENDING', -- 完了（評価待ち）
  'COMPLETED_RATED',   -- 評価済み
  'CANCELLED'          -- キャンセル
);

-- 評価ステータス
CREATE TYPE review_status AS ENUM (
  'PENDING',   -- 評価待ち
  'COMPLETED'  -- 評価済み
);

-- 評価者タイプ
CREATE TYPE reviewer_type AS ENUM (
  'WORKER',   -- ワーカーから施設
  'FACILITY'  -- 施設からワーカー
);

-- ブックマークタイプ
CREATE TYPE bookmark_type AS ENUM (
  'FAVORITE',    -- お気に入り
  'WATCH_LATER'  -- 後で見る
);

-- 通知タイプ
CREATE TYPE notification_type AS ENUM (
  'APPLICATION_APPROVED',
  'APPLICATION_REJECTED',
  'NEW_MESSAGE',
  'REVIEW_REQUEST',
  'SYSTEM'
);
```

---

## 4. 認証設計

### 4.1 ワーカー認証（NextAuth.js）

```typescript
// lib/auth.ts
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      authorize: async (credentials) => {
        // メール/パスワード認証
        // bcryptでパスワード検証
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30日
  },
  callbacks: {
    jwt: async ({ token, user }) => { ... },
    session: async ({ session, token }) => { ... },
  },
};
```

### 4.2 施設管理者認証（独自実装）

```typescript
// lib/admin-session.ts
interface AdminSessionData {
  adminId: number;
  facilityId: number;
  name: string;
  email: string;
  role: string;
  createdAt: number;
  expiresAt: number;  // 8時間後
}

// localStorageで管理
// - タブ間で共有
// - セッション有効期限チェック
// - 8時間で自動ログアウト
// - ユーティリティ関数で管理
```

---

## 5. API設計（Server Actions）

### 5.1 Server Actions一覧

#### 認証関連
| 関数名 | 説明 |
|--------|------|
| `getAuthenticatedUser()` | 認証済みワーカー取得 |
| `authenticateFacilityAdmin()` | 施設管理者認証 |

#### 求人関連
| 関数名 | 説明 |
|--------|------|
| `getJobs()` | 求人一覧取得（フィルタリング対応） |
| `getJobById()` | 求人詳細取得 |
| `createJobs()` | 求人作成 |
| `updateJob()` | 求人更新 |
| `deleteJobs()` | 求人削除 |

#### 応募関連
| 関数名 | 説明 |
|--------|------|
| `applyForJob()` | 求人に応募 |
| `getMyApplications()` | 自分の応募一覧 |
| `updateApplicationStatus()` | 応募ステータス更新 |
| `getJobsWithApplications()` | 応募付き求人一覧 |

#### メッセージ関連
| 関数名 | 説明 |
|--------|------|
| `sendMessage()` | メッセージ送信 |
| `getMessages()` | メッセージ取得 |
| `getConversations()` | 会話一覧取得 |
| `markMessagesAsRead()` | 既読処理 |

#### レビュー関連
| 関数名 | 説明 |
|--------|------|
| `submitReview()` | レビュー投稿 |
| `getMyReviews()` | 自分のレビュー一覧 |
| `getFacilityReviews()` | 施設のレビュー |
| `submitWorkerReview()` | ワーカー評価 |

#### ブックマーク関連
| 関数名 | 説明 |
|--------|------|
| `addJobBookmark()` | ブックマーク追加 |
| `removeJobBookmark()` | ブックマーク削除 |
| `getBookmarkedJobs()` | ブックマーク一覧 |

### 5.2 API Routes

| パス | メソッド | 説明 |
|------|----------|------|
| `/api/auth/[...nextauth]` | * | NextAuth認証 |
| `/api/auth/register` | POST | ワーカー新規登録 |
| `/api/upload` | POST | ファイルアップロード |
| `/api/cron/update-statuses` | GET | ステータス自動更新 |

---

## 6. セキュリティ設計

### 6.1 認証セキュリティ
- パスワードハッシュ化: bcrypt
- セッション管理: JWT（ワーカー）、localStorage（管理者）
- セッション有効期限: 8時間

### 6.2 入力検証
- Server Actionsで入力値バリデーション
- SQLインジェクション防止: Prisma ORM
- XSS防止: Reactの自動エスケープ

#### 入力フォーマット仕様
| フィールド | 形式 | 備考 |
|-----------|------|------|
| 電話番号 | 数字のみ（10桁または11桁） | 全角数字は自動で半角に変換。ハイフンは自動挿入しない |
| 郵便番号 | 7桁（ハイフン自動挿入: 123-4567） | 全角数字は自動で半角に変換 |
| 法人番号 | 13桁（数字のみ） | - |
| カタカナ | 全角カタカナのみ | ひらがなは自動でカタカナに変換 |

### 6.3 ファイルアップロード
- 許可形式: jpg, jpeg, png, gif, webp
- 最大サイズ: 5MB
- 保存先: `/public/uploads/`

---

## 7. 開発環境

### 7.1 ローカル環境構築

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# リント
npm run lint

# データベース起動
docker-compose up -d

# Prisma Studio
npx prisma studio

# マイグレーション
npx prisma migrate dev

# シード実行
tsx prisma/seed.ts
```

### 7.2 環境変数

```env
# データベース
DATABASE_URL="postgresql://user:password@localhost:5432/+tastas"

# NextAuth
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
```

---

## 8. 用語定義

### 8.1 求人関連

| 用語 | 正式名称 | 説明 |
|------|----------|------|
| **親求人** | Job | `Job`テーブルのレコード。施設管理画面で求人作成時に作成される求人本体。タイトル、時給、勤務時間、勤務内容などの共通情報を持つ。 |
| **子求人** | JobWorkDate | `JobWorkDate`テーブルのレコード。親求人に紐づく各勤務日。求人作成時に複数の日付を選択すると、その日付ひとつひとつが子求人として作成される。ワーカーは子求人（勤務日）に対して応募する。 |

### 8.2 マッチング期間

| 指標名 | 計算方法 | 説明 |
|--------|----------|------|
| **応募マッチング期間** | `Application.created_at` → `status = SCHEDULED`になった時点 | ワーカーが応募してからマッチング（採用）されるまでの期間。施設管理者の応募承認スピードを測る指標。 |
| **求人マッチング期間** | `Job`の公開日時 → 最初の`Application`が`SCHEDULED`になった時点 | 求人が公開されてから最初のマッチングが発生するまでの期間。求人の魅力度や市場の需給バランスを測る指標。 |

### 8.3 応募ステータス

| ステータス | 意味 | 説明 |
|------------|------|------|
| `APPLIED` | 応募中 | ワーカーが応募した状態。施設管理者の承認待ち。 |
| `SCHEDULED` | 勤務予定（マッチング） | 施設管理者が応募を承認し、マッチングが成立した状態。 |
| `WORKING` | 稼働中 | 勤務当日、実際に勤務している状態。 |
| `COMPLETED_PENDING` | 完了（評価待ち） | 勤務完了後、評価がまだの状態。 |
| `COMPLETED_RATED` | 評価済み | 相互評価が完了した状態。 |
| `CANCELLED` | キャンセル | 応募または勤務がキャンセルされた状態。 |

---

## 9. 指標定義

> **重要**: この定義は `app/system-admin/analytics/tabs/MetricDefinitions.tsx` の `METRIC_DEFINITIONS` オブジェクトと同期する必要があります。指標の追加・変更時は双方を更新してください。

### 9.1 ワーカー関連

| 指標キー | 指標名 | 定義 | 計算方法 | 使用箇所 |
|----------|--------|------|----------|----------|
| `totalWorkers` | 登録ワーカー数 | 現在登録されているワーカーの総数（退会者を除く） | users テーブルで deleted_at IS NULL のレコード数 | ダッシュボード KPI、ワーカー分析 |
| `newCount` | 入会ワーカー数 | 指定期間内に新規登録したワーカーの数 | 指定期間の created_at を持つ users レコード数 | ダッシュボード トレンド、ワーカー分析 |
| `withdrawnCount` | 退会ワーカー数 | 指定期間内に退会したワーカーの数 | 指定期間の deleted_at を持つ users レコード数 | ワーカー分析 |
| `withdrawalRate` | 退会率 | 期間開始時の登録ワーカー数に対する退会者の割合 | 退会ワーカー数 ÷ 期間開始時の登録ワーカー数 × 100 | ワーカー分析 |
| `workerReviewCount` | レビュー数（ワーカー受領） | ワーカーが施設から受けたレビューの数 | reviews テーブルで reviewer_type = FACILITY のレコード数 | ワーカー分析 |
| `workerReviewAvg` | レビュー平均点（ワーカー） | ワーカーが施設から受けたレビューの平均評価 | レビュー合計点 ÷ レビュー数 | ワーカー分析、アラート判定 |
| `cancelRate` | キャンセル率 | ワーカーによる応募キャンセルの割合 | ワーカーキャンセル数 ÷ 総応募数 × 100 | ワーカー分析、アラート判定 |
| `lastMinuteCancelRate` | 直前キャンセル率 | 勤務前日以降にキャンセルした割合（全応募数に対する比率） | 勤務前日以降のキャンセル数 ÷ 全応募数 × 100 | ワーカー分析 |

### 9.2 施設関連

| 指標キー | 指標名 | 定義 | 計算方法 | 使用箇所 |
|----------|--------|------|----------|----------|
| `totalFacilities` | 登録施設数 | 現在登録されている施設の総数（退会施設を除く） | facilities テーブルで deleted_at IS NULL のレコード数 | ダッシュボード KPI、施設分析 |
| `newFacilityCount` | 施設登録数 | 指定期間内に新規登録した施設の数 | 指定期間の created_at を持つ facilities レコード数 | ダッシュボード トレンド、施設分析 |
| `facilityReviewCount` | レビュー数（施設受領） | 施設がワーカーから受けたレビューの数 | reviews テーブルで reviewer_type = WORKER のレコード数 | 施設分析 |
| `facilityReviewAvg` | レビュー平均点（施設） | 施設がワーカーから受けたレビューの平均評価 | レビュー合計点 ÷ レビュー数 | 施設分析、アラート判定 |
| `parentJobInterviewCount` | 親求人数（面接あり） | 面接ありの親求人の数 | jobs テーブルで requires_interview = true のレコード数 | 施設分析 |
| `childJobInterviewCount` | 子求人数（面接あり） | 面接ありの親求人に紐づく子求人の数 | job_work_dates テーブルで紐づく job の requires_interview = true のレコード数 | 施設分析 |
| `withdrawnFacilityCount` | 退会施設数 | 指定期間内に退会した施設の数 | 指定期間の deleted_at を持つ facilities レコード数 | 施設分析 |
| `facilityWithdrawalRate` | 施設退会率 | 期間開始時の登録施設数に対する退会施設の割合 | 退会施設数 ÷ 期間開始時の登録施設数 × 100 | 施設分析 |

### 9.3 求人関連

| 指標キー | 指標名 | 定義 | 計算方法 | 使用箇所 |
|----------|--------|------|----------|----------|
| `parentJobCount` | 親求人数 | 求人の基本情報（Job テーブル）の数。1つの親求人に複数の勤務日（子求人）が紐づく | jobs テーブルで status = PUBLISHED のレコード数 | ダッシュボード KPI、応募・マッチング分析 |
| `childJobCount` | 子求人数 | 実際の勤務日単位の求人数（JobWorkDate テーブル）。ワーカーはこの単位で応募する | job_work_dates テーブルのレコード数 | ダッシュボード KPI、応募・マッチング分析 |
| `totalSlots` | 総応募枠数 | 全ての子求人の募集人数（recruitment_count）の合計 | Σ (各子求人の recruitment_count) | 応募・マッチング分析 |
| `remainingSlots` | 応募枠数（残り） | 全ての子求人で、まだ埋まっていない応募枠の合計 | Σ (各子求人の recruitment_count - 確定済み応募数) | ダッシュボード KPI、応募・マッチング分析 |
| `parentJobsPerFacility` | 施設あたり親求人数 | 1施設あたりの平均親求人数 | 親求人数 ÷ アクティブ施設数 | 応募・マッチング分析 |
| `childJobsPerFacility` | 施設あたり子求人数 | 1施設あたりの平均子求人数 | 子求人数 ÷ アクティブ施設数 | 応募・マッチング分析 |
| `limitedJobCount` | 限定求人数 | 勤務済みワーカー限定またはお気に入りワーカー限定の求人数 | jobs テーブルで job_type IN (LIMITED_WORKED, LIMITED_FAVORITE) のレコード数 | 応募・マッチング分析 |
| `offerJobCount` | オファー数 | 施設から特定ワーカーへ送られた個別オファーの数 | jobs テーブルで job_type = OFFER のレコード数 | 応募・マッチング分析 |
| `offerAcceptanceRate` | オファー承諾率 | オファー求人のうち、ワーカーが承諾した割合 | オファー承諾数 ÷ オファー求人数 × 100 | 応募・マッチング分析 |
| `limitedJobApplicationRate` | 限定求人応募率 | 限定求人に対して応募があった割合 | 限定求人への応募数 ÷ 限定求人数 × 100 | 応募・マッチング分析 |

### 9.4 応募・マッチング関連

| 指標キー | 指標名 | 定義 | 計算方法 | 使用箇所 |
|----------|--------|------|----------|----------|
| `applicationCount` | 応募数 | 指定期間内に行われた応募の総数 | applications テーブルで指定期間内の created_at を持つレコード数 | 応募・マッチング分析 |
| `matchingCount` | マッチング数 | 応募がマッチング成立（SCHEDULED以上）したものの数 | status が APPLIED, CANCELLED 以外の応募数 | ダッシュボード トレンド、応募・マッチング分析 |
| `avgMatchingHours` | マッチング期間（時間） | 親求人が作成されてからマッチングが成立するまでの平均時間 | Σ (マッチング成立時刻 - 親求人作成時刻) ÷ マッチング数 | ダッシュボード トレンド、応募・マッチング分析 |
| `avgApplicationMatchingPeriod` | 応募→マッチング平均 | ワーカーが応募してからマッチングするまでの平均時間 | Σ (マッチング成立時刻 - 応募時刻) ÷ マッチング数 | 応募・マッチング分析 |
| `avgJobMatchingPeriod` | 求人公開→初回マッチング平均 | 求人が公開されてから最初のマッチングが成立するまでの平均時間 | 各求人の (初回マッチング時刻 - 求人公開時刻) の平均 | 応募・マッチング分析 |
| `applicationsPerWorker` | ワーカーあたり応募数 | アクティブワーカー1人あたりの平均応募数 | 応募数 ÷ アクティブワーカー数 | ダッシュボード トレンド、応募・マッチング分析 |
| `matchingsPerWorker` | ワーカーあたりマッチング数 | アクティブワーカー1人あたりの平均マッチング数 | マッチング数 ÷ アクティブワーカー数 | ダッシュボード トレンド、応募・マッチング分析 |
| `reviewsPerWorker` | ワーカーあたりレビュー数 | アクティブワーカー1人あたりの平均レビュー受領数 | ワーカー受領レビュー数 ÷ アクティブワーカー数 | 応募・マッチング分析 |
| `matchingsPerFacility` | 施設あたりマッチング数 | アクティブ施設1施設あたりの平均マッチング数 | マッチング数 ÷ アクティブ施設数 | 応募・マッチング分析 |
| `reviewsPerFacility` | 施設あたりレビュー数 | アクティブ施設1施設あたりの平均レビュー受領数 | 施設受領レビュー数 ÷ アクティブ施設数 | 応募・マッチング分析 |

### 9.5 LP基本トラッキング関連

| 指標キー | 指標名 | 定義 | 計算方法 | 使用箇所 |
|----------|--------|------|----------|----------|
| `lpPV` | PV（ページビュー） | LPページが読み込まれた回数。同一ユーザーが複数回訪問してもそれぞれ1PV | lp_page_views テーブルで対象LP・期間のレコード数 | LP分析（公開求人）、LP分析（LP別アクセス状況）、LPトラッキング |
| `lpSessions` | セッション | ユニークな訪問数。sessionStorageベースのセッションIDで識別 | lp_page_views テーブルで対象LP・期間のユニーク session_id 数 | LP分析（公開求人）、LP分析（LP別アクセス状況）、LPトラッキング |
| `lpEvents` | イベント（CTAクリック） | CTAボタンがクリックされた回数。通常LP: LINE友だち追加リンク等、LP0: 会員登録ボタン | lp_click_events テーブルで対象LP・期間のレコード数 | LP分析（公開求人）、LP分析（LP別アクセス状況）、LPトラッキング |
| `lpEventCTR` | イベントCTR | セッションあたりのCTAクリック率 | イベント数 ÷ セッション数 × 100 | LP分析（LP別アクセス状況）、LPトラッキング |
| `lpRegistrations` | 登録数 | LP経由での会員登録数。LP訪問時にlocalStorageに保存されたLP IDが登録時に紐付け | users テーブルで registration_lp_id が対象LP のレコード数 | LP分析（公開求人）、LP分析（LP別アクセス状況）、LPトラッキング |
| `lpJobDetailPV` | 求人閲覧数（LP0） | LP0の求人詳細ページ（/public/jobs/[id]）の閲覧回数。LP0固有 | public_job_page_views テーブルで lp_id=0・期間のレコード数 | LP分析（公開求人） |
| `lpAvgDwellTime` | 平均滞在時間 | LP滞在時間の平均。通常LP: 最大300秒、LP0: 最大600秒でキャップ | lp_engagement_summaries テーブルで total_dwell_time の平均 | LP分析（公開求人）、LPトラッキング |

### 9.6 LP帰属トラッキング関連

| 指標キー | 指標名 | 定義 | 計算方法 | 使用箇所 |
|----------|--------|------|----------|----------|
| `registrationRate` | 登録率 | LP閲覧セッションのうち、ワーカー登録に至った割合。旧名称「CVR」と同一指標 | 登録数 ÷ セッション数 × 100 | LP分析（公開求人）、LP分析（LP別アクセス状況） |
| `parentJobPV` | 親求人PV | LP経由で登録したワーカーがプラットフォーム内で求人詳細ページを閲覧した回数 | job_detail_page_views テーブルで対象LP帰属ユーザー（User.registration_lp_id）のレコード数 | LP分析（公開求人）、LP分析（LP別アクセス状況） |
| `parentJobSessions` | 親求人セッション | LP経由で登録したワーカーのうち、求人詳細ページを1回以上閲覧したユニークユーザー数 | job_detail_page_views テーブルで対象LP帰属ユーザーのユニーク user_id 数 | LP分析（公開求人）、LP分析（LP別アクセス状況） |
| `lpApplicationCount` | 応募数（LP帰属） | LP経由で登録したワーカーが行った応募の総数。Application テーブルをLP帰属フィルターで絞り込み | applications テーブルで user.registration_lp_id が対象LP のレコード数 | LP分析（公開求人）、LP分析（LP別アクセス状況） |
| `applicationRate` | 応募率 | LP経由で登録したワーカーのうち、1回以上応募したユニークユーザーの割合（登録数基準、100%を超えない） | 応募ユニークユーザー数（LP帰属） ÷ 登録数 × 100 | LP分析（公開求人）、LP分析（LP別アクセス状況） |
| `avgDaysToApplication` | 平均応募日数 | LP経由で登録したワーカー1人あたりの平均応募日数（何日分のシフトに応募したか） | 応募数（LP帰属） ÷ ユニーク応募ワーカー数 | LP分析（公開求人）、LP分析（LP別アクセス状況） |
| `applicationDays` | 応募日数 | 期間内の応募総数（1応募=1勤務日） | applicationCountと同値 | 応募・マッチング分析 |
| `avgApplicationDays` | 平均応募日数（応募・マッチング） | ワーカー1人あたりの平均応募日数 | 応募数 ÷ ユニーク応募ワーカー数 | 応募・マッチング分析 |

### 9.7 求人分析（ログイン後）関連

> **注意**: 求人分析タブの全指標は退会済みユーザーのログも含めて集計します（deleted_at 不問）。

| 指標キー | 指標名 | 定義 | 計算方法 | 使用箇所 |
|----------|--------|------|----------|----------|
| `jobAnalyticsTotalPV` | 求人PV | ログイン後ユーザーが求人詳細ページを閲覧した総回数（退会済みユーザーも含む） | job_detail_page_views テーブルの期間内レコード数（deleted_at 不問） | 求人分析 |
| `jobAnalyticsTotalUsers` | 閲覧ユーザー数 | 期間内に求人詳細ページを1回以上閲覧したユニークユーザー数（退会済みユーザーも含む） | job_detail_page_views テーブルの期間内ユニーク user_id 数（deleted_at 不問） | 求人分析 |
| `jobAnalyticsApplicationCount` | 応募数（求人分析） | 期間内の応募総数（退会済みユーザーの応募も含む） | applications テーブルの期間内レコード数（deleted_at 不問） | 求人分析 |
| `jobAnalyticsApplicationUserCount` | 応募ユニークユーザー数 | 期間内に1回以上応募したユニークユーザー数（退会済みユーザーも含む） | applications テーブルの期間内ユニーク user_id 数（deleted_at 不問） | 求人分析 |
| `jobAnalyticsApplicationRate` | 応募率（求人分析） | 求人詳細を閲覧したユーザーのうち応募したユーザーの割合 | 応募ユニークユーザー数 ÷ 閲覧ユーザー数 × 100 | 求人分析（求人ランキング） |
| `jobAnalyticsAvgApplicationDays` | 平均応募日数（求人分析） | 応募ユーザー1人あたりの平均応募数 | 応募数 ÷ 応募ユニークユーザー数 | 求人分析 |

### 9.8 登録動線分析関連

> **注意**: 登録動線分析の全指標は退会済みユーザーのログも含めて集計します（deleted_at 不問）。
>
> **集計方式**: サマリー（ファネルバー・総計テーブル）は**コホート集計**方式です。「期間内に登録したユーザー」を母集団とし、そのユーザーの行動を行動日に関係なく全て集計します。例えば期間を「2月」に指定した場合、2月に登録したユーザーが3月に行った求人閲覧や応募も含まれます。
>
> **ブレイクダウン**（日別/月別）は「行動日ベース」で集計します（コホート分析ではない）。そのため、2月に登録→3月にお気に入り の場合、3月行に「お気に入り」は入るが「登録」は入りません。各行で「お気に入り > 登録」のような逆転が起きうるのは仕様です。

| 指標キー | 指標名 | 種別 | 定義 | 計算方法 | 使用箇所 |
|----------|--------|------|------|----------|----------|
| `registrationPagePV` | 新規登録ページPV | PV | 新規登録ページ（/register/worker）の閲覧数。未ログインユーザー対象でsessionStorageベースのセッションIDで記録。ソースフィルターの影響を受けない | registration_page_views テーブルの期間内レコード数（日付フィルターのみ、ソースフィルター不可） | 登録動線分析 |
| `registrationPageUU` | 新規登録ページUU | UU | 新規登録ページのユニーク訪問者数。sessionStorageベースのセッションIDで識別。ソースフィルターの影響を受けない | registration_page_views テーブルの期間内ユニーク session_id 数（日付フィルターのみ、ソースフィルター不可） | 登録動線分析 |
| `funnelRegistered` | 登録完了数（登録動線） | UU | 期間内に新規登録したユーザー数（退会済みユーザーも含む） | users テーブルで期間内の created_at を持つレコード数（deleted_at 不問） | 登録動線分析 |
| `funnelVerified` | メール認証完了数 | UU | 期間内に登録したユーザーのうちメール認証を完了したユーザー数 | 期間内登録ユーザーのうち email_verified = true のレコード数 | 登録動線分析 |
| `searchPV` | 求人検索PV | PV | 期間内に登録したユーザーによる求人検索ページの総閲覧数。行動の日付は問わない（コホート集計） | job_search_page_views テーブルで期間内登録ユーザーの全レコード数（行動日フィルターなし） | 登録動線分析 |
| `funnelSearchReached` | 求人検索到達UU | UU | 期間内に登録したユーザーのうち求人検索ページに到達したユーザー数。行動の日付は問わない（コホート集計） | job_search_page_views テーブルで期間内登録ユーザーのユニーク user_id 数（行動日フィルターなし） | 登録動線分析 |
| `jobViewedPV` | 求人詳細PV | PV | 期間内に登録したユーザーによる求人詳細ページの総閲覧数。行動の日付は問わない（コホート集計） | job_detail_page_views テーブルで期間内登録ユーザーの全レコード数（行動日フィルターなし） | 登録動線分析 |
| `funnelJobViewed` | 求人詳細閲覧UU（登録動線） | UU | 期間内に登録したユーザーのうち求人詳細ページを1回以上閲覧したユーザー数。行動の日付は問わない（コホート集計） | job_detail_page_views テーブルで期間内登録ユーザーのユニーク user_id 数（行動日フィルターなし） | 登録動線分析 |
| `funnelBookmarked` | お気に入り登録数（登録動線） | UU | 期間内に登録したユーザーのうち1件以上求人をお気に入り登録したユーザー数（施設お気に入りは除外）。行動の日付は問わない（コホート集計） | bookmarks テーブルで type=FAVORITE かつ target_job_id IS NOT NULL の期間内登録ユーザーのユニーク user_id 数（行動日フィルターなし） | 登録動線分析 |
| `applicationClickUU` | 応募ボタンクリックUU | UU | 期間内に登録したユーザーのうち応募ボタンをクリックしたユニークユーザー数。確認モーダル表示時に記録。行動の日付は問わない（コホート集計） | application_click_events テーブルで期間内登録ユーザーのユニーク user_id 数（行動日フィルターなし） | 登録動線分析 |
| `funnelApplied` | 応募完了UU（登録動線） | UU | 期間内に登録したユーザーのうち1件以上応募を完了したユーザー数（キャンセル済みも含む＝行動ログとして記録）。行動の日付は問わない（コホート集計） | applications テーブルで期間内登録ユーザーのユニーク user_id 数（行動日フィルターなし） | 登録動線分析 |
| `applicationTotal` | 応募総数（登録動線） | PV | 期間内に登録したユーザーによる応募の総件数。行動の日付は問わない（コホート集計） | applications テーブルで期間内登録ユーザーの全レコード数（行動日フィルターなし） | 登録動線分析 |
| `overallConversionRate` | 全体コンバージョン率 | - | 期間内に登録したユーザーのうち応募に至ったユーザーの割合 | 応募完了UU ÷ 登録完了数 × 100 | 登録動線分析 |
| `avgRegistrationToVerifyHours` | 登録→認証 平均所要時間 | - | ユーザー登録からメール認証完了までの平均時間（時間単位） | Σ (email_verified_at - created_at) ÷ 認証済みユーザー数 | 登録動線分析 |

> **ソースフィルター時の制約**: 新規登録ページPV/UUはsessionStorageベースの匿名データのため、流入元（LP）への帰属ができません。ソースフィルター適用時は「-」と表示されます。また、ソースフィルター適用時は「登録ページUU → 登録完了」間の転換率も「-」と表示されます（分母が全体データ、分子がフィルター済みデータとなり、誤解を招くため）。

### 9.9 アラート判定

| 指標キー | 指標名 | 定義 | 計算方法 | 使用箇所 |
|----------|--------|------|----------|----------|
| `avgRatingThreshold` | 平均評価閾値 | この値以下の平均評価でアラートが発動する | 通知設定で設定可能（デフォルト: 2.5） | ダッシュボード アラート |
| `cancelRateThreshold` | キャンセル率閾値 | この値を超えるキャンセル率でアラートが発動する | 通知設定で設定可能（デフォルト: 30%） | ダッシュボード アラート |
| `consecutiveLowRatingCount` | 連続低評価回数 | この回数連続で低評価を受けるとアラートが発動する | 通知設定で設定可能（デフォルト: 3回） | ダッシュボード アラート |

---

## 10. 通知システム

### 10.1 概要

通知は `notification_settings` テーブルで一元管理され、システム管理画面（`/system-admin/content/notifications`）から設定可能。

**送信チャネル:**
| チャネル | 説明 | 制御フィールド |
|----------|------|---------------|
| チャット | Messageテーブルに保存、アプリ内メッセージとして表示 | `chat_enabled` |
| メール | Resend経由で送信 | `email_enabled` |
| プッシュ | Web Push通知 | `push_enabled` |

### 10.2 通知設定テーブル

```sql
notification_settings (
  id                SERIAL PRIMARY KEY,
  notification_key  VARCHAR UNIQUE NOT NULL,  -- 通知識別キー
  name              VARCHAR NOT NULL,          -- 管理画面表示名
  description       TEXT,                      -- 説明
  target_type       VARCHAR NOT NULL,          -- 'WORKER' | 'FACILITY' | 'SYSTEM_ADMIN'

  -- チャネル有効/無効
  chat_enabled      BOOLEAN DEFAULT false,
  email_enabled     BOOLEAN DEFAULT false,
  push_enabled      BOOLEAN DEFAULT false,

  -- テンプレート（変数は {{variable_name}} 形式）
  chat_message      TEXT,
  email_subject     VARCHAR,
  email_body        TEXT,
  push_title        VARCHAR,
  push_body         TEXT
)
```

### 10.3 通知キー一覧

#### ワーカー向け通知
| キー | 名称 | 説明 |
|------|------|------|
| `WORKER_APPLICATION_CONFIRMED` | 応募受付確認 | 求人への応募が受け付けられた時 |
| `WORKER_MATCHED` | マッチング成立 | 即マッチング求人で応募が承認された時 |
| `WORKER_INTERVIEW_ACCEPTED` | 審査あり求人：採用決定 | 審査後に採用が決定した時 |
| `WORKER_INTERVIEW_REJECTED` | 審査あり求人：不採用 | 審査後に不採用となった時 |
| `WORKER_CANCELLED_BY_FACILITY` | 施設からのキャンセル | 施設が予約をキャンセルした時 |
| `WORKER_REMINDER_DAY_BEFORE` | 勤務前日リマインド | 勤務前日に送信 |
| `WORKER_REMINDER_SAME_DAY` | 勤務当日リマインド | 勤務当日朝に送信 |
| `WORKER_REVIEW_REQUEST` | レビュー依頼 | 勤務終了後にレビュー投稿を依頼 |
| `WORKER_REVIEW_RECEIVED` | 施設からレビューが届いた | 施設からレビューが投稿された時 |
| `WORKER_NEW_MESSAGE` | 施設からのメッセージ | 施設から新しいメッセージが届いた時 |
| `WORKER_NEARBY_NEW_JOB` | 近隣エリアの新着求人 | 登録住所の近くで新しい求人が出た時 |
| `WORKER_NEARBY_CANCEL_AVAILABLE` | 近隣エリアのキャンセル枠発生 | 近くの求人でキャンセルが発生した時 |
| `FACILITY_INITIAL_GREETING` | 施設からの初回挨拶 | 初めてマッチングした施設からの挨拶 |

#### 施設向け通知
| キー | 名称 | 説明 |
|------|------|------|
| `FACILITY_NEW_APPLICATION` | 新規応募 | ワーカーから新しい応募があった時 |
| `FACILITY_CANCELLED_BY_WORKER` | ワーカーからのキャンセル | ワーカーが予約をキャンセルした時 |
| `FACILITY_APPLICATION_WITHDRAWN` | ワーカーからの応募取り消し | ワーカーが審査中の応募を取り消した時 |
| `FACILITY_REMINDER_DAY_BEFORE` | 勤務前日リマインド | 勤務前日に送信 |
| `FACILITY_REVIEW_REQUEST` | レビュー依頼 | 勤務終了後にレビュー投稿を依頼 |
| `FACILITY_REVIEW_RECEIVED` | ワーカーからレビューが届いた | ワーカーからレビューが投稿された時 |
| `FACILITY_NEW_MESSAGE` | ワーカーからのメッセージ | ワーカーから新しいメッセージが届いた時 |
| `FACILITY_SLOTS_FILLED` | 募集枠が埋まった | 求人の募集枠が全て埋まった時 |

#### システム管理者向け通知
| キー | 名称 | 説明 |
|------|------|------|
| `ADMIN_NEW_FACILITY` | 新規施設登録 | 新しい施設が登録された時 |
| `ADMIN_NEW_WORKER` | 新規ワーカー登録 | 新しいワーカーが登録された時 |
| `ADMIN_HIGH_CANCEL_RATE` | キャンセル率異常 | ユーザーのキャンセル率が閾値を超えた時 |

### 10.4 チャットメッセージの送信者

システムが自動送信するチャットメッセージは、**施設またはワーカーとして代理送信**される仕様。

```
┌────────────────────────────────────────────────────────┐
│ 通知タイプ                │ 送信者として設定           │
├────────────────────────────────────────────────────────┤
│ マッチング成立            │ from_facility_id（施設）   │
│ 初回挨拶                  │ from_facility_id（施設）   │
│ 応募確認                  │ from_facility_id（施設）   │
│ ワーカーキャンセル通知    │ from_user_id（ワーカー）   │
│ 応募取り消し通知          │ from_user_id（ワーカー）   │
└────────────────────────────────────────────────────────┘
```

**注意:** 「運営から」という送信者は存在しない。ワーカーが返信すると施設に通知され、施設側には自分が送ったように見えるメッセージへの返信として表示される。

### 10.5 テンプレート変数

テンプレート内で使用可能な変数（`{{variable_name}}` 形式）:

| 変数 | 説明 |
|------|------|
| `{{worker_name}}` | ワーカーのフルネーム |
| `{{worker_last_name}}` | ワーカーの名字 |
| `{{facility_name}}` | 施設名 |
| `{{job_title}}` | 求人タイトル |
| `{{work_date}}` | 勤務日 |
| `{{start_time}}` | 開始時刻 |
| `{{end_time}}` | 終了時刻 |
| `{{hourly_wage}}` | 時給 |
| `{{job_url}}` | 求人詳細URL |
| `{{applied_dates}}` | 応募日程一覧 |

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-02-25 | 登録動線分析（9.8）: 集計方式を「コホート集計」として明記、全指標の計算方法を実装と整合（行動日フィルターなし明記）、applicationTotal指標追加、ソースフィルター転換率制約追記 |
| 2026-02-25 | 登録動線分析（9.8）: PV指標4種追加（登録ページPV/UU、検索PV、詳細PV）、応募ボタンクリックUU追加、お気に入り定義修正（施設お気に入り除外）、ソースフィルター制約注記 |
| 2026-02-24 | 指標定義: 求人分析（9.7）・登録動線分析（9.8）セクション追加、退会済みユーザーのログ保持ポリシー明記 |
| 2026-01-04 | 通知システムセクション追加（通知設定の一元管理、チャット代理送信仕様） |
| 2025-12-13 | 指標定義セクション追加（MetricDefinitions.tsxと同期） |
| 2025-12-10 | 用語定義セクション追加（親求人/子求人、マッチング期間の定義） |
| 2025-12-04 | 実装済みシステムに基づく設計書を新規作成 |
