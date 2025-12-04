# S WORKS - システム設計書

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
DATABASE_URL="postgresql://user:password@localhost:5432/sworks"

# NextAuth
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
```

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-12-04 | 実装済みシステムに基づく設計書を新規作成 |
