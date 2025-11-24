# S WORKS - プロジェクト仕様書

## 目次

1. [サービス概要](#1-サービス概要)
2. [主要機能](#2-主要機能)
3. [データ構造](#3-データ構造)
4. [技術スタック](#4-技術スタック)
5. [画面仕様](#5-画面仕様)
6. [ワークフロー](#6-ワークフロー)
7. [ビジネスモデル](#7-ビジネスモデル)

---

## 1. サービス概要

### 1.1 サービス名
**S WORKS（エスワークス）**

### 1.2 サービス説明
看護師・介護士のための求人マッチングWebサービス。
単発・短期の仕事を中心に、働きたい日時で柔軟に仕事を探せるプラットフォーム。

### 1.3 ターゲットユーザー
- 看護師（正看護師、准看護師）
- 介護士（介護福祉士、ヘルパー等）
- ブランクがある方
- 副業・Wワークを希望する方
- 単発・短期で働きたい方

---

## 2. 主要機能

### 2.1 ワーカー（求職者）機能

#### 2.1.1 会員登録・ログイン
- **会員登録**
  - メールアドレス + パスワード
  - SNS連携（Google、LINE）
  - 基本情報登録（氏名、生年月日、電話番号）
  - 資格情報登録（看護師、介護福祉士等）
  - プロフィール写真（任意）

- **ログイン**
  - メールアドレス + パスワード
  - SNS連携ログイン
  - ログイン状態の保持

- **プロフィール管理**
  - 基本情報編集
  - 資格・経験年数の編集
  - 希望勤務条件の設定
  - 通知設定

#### 2.1.2 求人検索・閲覧

- **トップページ（求人一覧） `/` または `/job-list`**
  - 全体/限定/指名のタブ切り替え
    - 全体：すべての求人
    - 限定：ワーカー限定の特別求人
    - 指名：施設から指名された求人

- **検索フィルター機能**
  - 働ける日（カレンダー選択）
  - 勤務時間帯（朝、昼、夜、夜勤）
  - 施設種別（デイサービス、特養、有料老人ホーム等）
  - 職種（看護、介護）
  - エリア（都道府県、市区町村、駅）
  - 時給・日給範囲
  - 資格要件
  - その他条件（駅チカ、未経験OK、高時給等）

- **並べ替え機能**
  - 近い順（位置情報ベース）
  - 時給順（高い順）
  - 締切が近い順
  - 新着順

- **日付スライダー**
  - 今日から3ヶ月分の日付を横スクロール表示
  - 日付選択で該当日の求人を表示

- **求人カード表示**
  - 施設画像
  - 施設名
  - 施設評価（星5段階＋レビュー数）
  - 求人タイトル
  - 勤務時間
  - 報酬（日給・時給）
  - 締切時間（カウントダウン）
  - 住所・アクセス
  - タグ（施設種別、特徴）
  - **お気に入り機能**（ブックマークではなく、お気に入りに統一）

#### 2.1.3 求人詳細 `/jobs/[id]`

- **基本情報**
  - 勤務日時
  - 施設名・住所
  - 地図表示（Google Maps連携）
  - アクセス方法（交通手段、駐車場の有無）
  - 施設画像（複数枚、カルーセル表示）

- **募集情報**
  - 募集人数／応募状況
  - 職種・業務内容
  - 必要資格
  - 経験・スキル要件
  - 報酬（時給、日給、交通費）
  - 勤務時間・休憩時間
  - 締切日時

- **仕事内容詳細**
  - 業務内容の詳細説明
  - 仕事内容タグ（移乗介助、バイタル測定等）
  - 施設の特徴・雰囲気

- **事前情報**
  - 服装・持ち物
  - その他条件
  - 法人情報（法人名、電話番号）

- **レビュー**
  - 総合評価（星5段階）
  - 評価分布（5〜1の件数）
  - 個別レビュー
    - レビュアー情報（年代、性別、職種、勤務期間）
    - 良かった点
    - 改善点
  - レビュー件数表示
  - もっと見る機能

- **責任者情報**
  - 担当者名
  - 担当者メッセージ
  - 担当者アバター

- **その他の応募日時**
  - 同じ施設の別日程の求人表示
  - 横スクロールで複数表示

- **インタラクション**
  - お気に入り登録
  - あとで見る保存（このページのみ）
  - ミュート機能（この施設の求人を表示しない）
  - タブナビゲーション（仕事概要、申込条件、事前情報、レビュー）

#### 2.1.4 応募機能

- **応募フロー**
  1. 求人詳細ページで「申し込む」ボタンをクリック
  2. プロフィール完成度チェック
     - 資格情報が未登録の場合：プロフィール登録ページへリダイレクト
     - プロフィールが完成済みの場合：応募確認画面へ進む
  3. 応募確認画面（プロフィール、資格確認）
  4. 応募完了
  5. 完了画面表示
  6. 確認メール送信

- **応募管理 `/my-jobs`**
  - ステータス別タブ
    - scheduled（勤務予定）
    - working（勤務中）
    - completed_pending（評価待ち）
    - completed_rated（評価済み）
    - cancelled（キャンセル済み）
  - 各求人カード表示（コンパクト版）
    - 施設画像
    - 施設名、評価
    - 勤務日時
    - 時給、交通費、総支給額
    - ステータスに応じたアクションボタン
      - scheduled/working: キャンセル、メッセージ
      - completed_pending: 評価する、メッセージ
      - completed_rated/cancelled: メッセージのみ

#### 2.1.5 メッセージ機能 `/messages`

- **メッセージタブとお知らせタブ**
  - タブ切り替え: メッセージ / お知らせ

- **メッセージタブの機能**
  - 施設名での検索機能
  - ソート機能（リスト選択形式）
    - 新着順：最新メッセージのタイムスタンプ順
    - 勤務日順：最後に働いた日付順
  - メッセージルーム一覧
    - 施設画像、施設名、評価
    - 最新メッセージプレビュー
    - 最終メッセージ日時
    - 未読バッジ（未読メッセージがある場合）
  - URL パラメータ `?roomId=facilityName` で直接特定の施設とのチャットルームを開く

- **お知らせタブ**
  - システムからのお知らせ一覧
  - 検索・ソート機能なし

#### 2.1.6 下部ナビゲーション

5つのメニュー:
1. **探す** (`/job-list`) - 求人検索・一覧表示
2. **お気に入り** (`/favorites`) - お気に入り登録した求人一覧
3. **メッセージ** (`/messages`) - 施設とのメッセージ、未読バッジ表示
4. **仕事管理** (`/my-jobs`) - 応募・勤務管理
5. **マイページ** (`/mypage`) - プロフィール、設定

---

### 2.2 施設（求人掲載側）機能

#### 2.2.1 施設アカウント登録
- 法人情報登録
- 施設情報登録
- 担当者情報登録
- 本人確認（書類審査）

#### 2.2.2 求人掲載

**テンプレート機能**
- 施設ごとにテンプレートを作成・管理
  - テンプレートは単一施設に紐づく
  - 同じ施設の求人を効率的に作成するためのテンプレート
- テンプレート管理 `/admin/jobs/templates`
  - テンプレート一覧表示
  - テンプレート作成 `/admin/jobs/templates/new`
  - テンプレート編集 `/admin/jobs/templates/[id]/edit`
  - テンプレート削除
  - テンプレート複製機能
- テンプレート内容
  - 求人タイトル
  - 勤務時間（開始時刻、終了時刻、休憩時間）
  - 時給、交通費
  - 募集人数
  - 必要資格
  - 仕事内容
  - スキル・経験（5件まで）
  - 服装・身だしなみ（5件まで）
  - 持ち物・その他（5件まで）
  - 施設のデフォルト画像（template.images）
  - 備考
  - タグ

**求人情報入力 `/admin/jobs/new`**
- 施設選択
- テンプレート選択（任意）
- 勤務日時
- 募集人数
- 職種・業務内容
- 必要資格・経験
- 報酬
- 交通費
- 施設情報・写真登録
- 掲載期間設定
- プレビュー・公開

#### 2.2.3 応募者管理 `/admin/workers`
- マッチング済みワーカー一覧（`applied` ステータスは除外）
- ワーカープロフィール確認
- ステータス別フィルター
- メッセージ送信

#### 2.2.4 ワーカー管理
- 勤務実績記録
- 評価・レビュー（双方向評価システム）
- 指名機能（リピート依頼）
- **お気に入り登録**: 良いワーカーをお気に入りに追加
- **あとで見る**: 気になるワーカーを一時保存

#### 2.2.5 限定求人
- 特定ワーカーへの限定公開
- 条件を満たすワーカーへの自動公開
  - 過去の勤務経験あり
  - 高評価ワーカー
  - 特定資格保持者

#### 2.2.6 施設情報管理 `/admin/facility`
- 施設基本情報編集
- 法人情報編集
- 施設画像管理
- 初回メッセージ設定（マッチング時に自動送信されるメッセージ）

#### 2.2.7 メッセージ機能 `/admin/messages`
- ワーカーとのメッセージ
- ワーカー検索機能
- マッチング時に自動メッセージ送信（施設の初回メッセージ設定を使用）

---

## 3. データ構造

### 3.1 主要テーブル

#### Users（ワーカー）
```typescript
interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  birth_date: string;
  phone_number: string;
  profile_image?: string;
  qualifications: string[]; // 資格情報
  created_at: string;
  updated_at: string;
}
```

#### Facilities（施設）
```typescript
interface Facility {
  id: number;
  corporation_name: string; // 法人名
  facility_name: string;    // 施設名
  facility_type: string;    // 施設種別
  address: string;
  lat: number;              // 緯度
  lng: number;              // 経度
  phone_number: string;
  description: string;
  images: string[];         // 画像URL配列
  rating: number;           // 平均評価
  review_count: number;
  created_at: string;
  updated_at: string;
}
```

#### JobTemplates（求人テンプレート）
```typescript
interface JobTemplate {
  id: number;
  facility_id: number;      // 施設ID（テンプレートは施設に紐づく）
  name: string;             // テンプレート名
  title: string;            // 求人タイトル
  start_time: string;       // HH:MM
  end_time: string;         // HH:MM
  break_time: number;       // 休憩時間（分）
  hourly_wage: number;      // 時給
  transportation_fee: number;
  recruitment_count: number; // 募集人数
  qualifications: string[]; // 必要資格
  description: string;      // 仕事内容
  skills: string[];         // スキル・経験（5件まで）
  dresscode: string[];      // 服装・身だしなみ（5件まで）
  belongings: string[];     // 持ち物・その他（5件まで）
  images: string[];         // デフォルト画像（この施設のデフォルト画像として使用）
  notes: string;            // 備考
  tags: string[];
  created_at: string;
  updated_at: string;
}
```

**重要**: テンプレートは施設に紐づく。各施設が自施設用の求人テンプレートを複数持つことができる。

#### Jobs（求人）
```typescript
interface Job {
  id: number;
  facility_id: number;
  template_id?: number;     // 使用したテンプレートID（任意）
  title: string;
  work_date: string;        // YYYY-MM-DD
  start_time: string;       // HH:MM
  end_time: string;         // HH:MM
  break_time: string;       // 例: "12:00-13:00"
  wage: number;             // 日給
  hourly_wage: number;      // 時給
  transportation_fee: number;
  deadline: string;         // ISO 8601
  tags: string[];
  address: string;
  access: string;
  recruitment_count: number; // 募集人数
  applied_count: number;    // 応募済み人数
  overview: string;
  work_content: string[];
  required_qualifications: string[];
  required_experience: string[];
  dresscode: string[];
  belongings: string[];
  manager_name: string;
  manager_message: string;
  manager_avatar: string;
  images: string[];
  created_at: string;
  updated_at: string;
}
```

**注意**: 求人作成時にテンプレートを使用した場合、`template_id` にテンプレートIDを保存。テンプレートの `images` フィールドは、その施設のデフォルト画像として、求人作成時に `job.images` にコピーされる。

#### Applications（応募・マッチング）
```typescript
type WorkerStatus =
  | 'applied'           // 応募（施設承認待ち）
  | 'scheduled'         // 勤務予定（施設が承認済み）
  | 'working'           // 勤務中
  | 'completed_pending' // 完了・評価待ち
  | 'completed_rated'   // 評価完了
  | 'cancelled';        // キャンセル

interface Application {
  id: number;
  job_id: number;
  user_id: number;
  status: WorkerStatus;
  worker_review_status: 'pending' | 'completed';    // ワーカー→施設の評価状態
  facility_review_status: 'pending' | 'completed';  // 施設→ワーカーの評価状態
  message?: string;
  created_at: string;
  updated_at: string;
}
```

**評価フロー（双方向評価システム）**:
- 勤務完了後、両者が評価を行う
- `status: 'completed_pending'`: 両者またはいずれかの評価が未完了
- `status: 'completed_rated'`: 両者の評価が完了
- 評価状態の組み合わせ:
  1. 両者とも未評価: `worker_review_status: 'pending'`, `facility_review_status: 'pending'`
  2. ワーカーのみ評価済み: `worker_review_status: 'completed'`, `facility_review_status: 'pending'`
  3. 施設のみ評価済み: `worker_review_status: 'pending'`, `facility_review_status: 'completed'`
  4. 両者とも評価済み: `worker_review_status: 'completed'`, `facility_review_status: 'completed'` → `status` を `completed_rated` に変更

#### Reviews（レビュー）
```typescript
interface Review {
  id: number;
  facility_id: number;
  user_id: number;
  job_id: number;
  application_id: number;
  reviewer_type: 'worker' | 'facility'; // 誰が評価したか
  rating: number;           // 1-5
  good_points?: string;
  improvements?: string;
  created_at: string;
  updated_at: string;
}
```

**双方向レビュー**:
- ワーカー→施設: `reviewer_type: 'worker'` で施設を評価
- 施設→ワーカー: `reviewer_type: 'facility'` でワーカーを評価

#### Bookmarks（お気に入り・あとで見る）
```typescript
type BookmarkType = 'favorite' | 'watch_later';
type BookmarkEntity = 'job' | 'worker';

interface Bookmark {
  id: number;
  user_id?: number;        // ワーカーID（ワーカーが保存した場合）
  facility_id?: number;    // 施設ID（施設が保存した場合）
  entity_type: BookmarkEntity;
  entity_id: number;       // job_id または worker_id
  type: BookmarkType;      // お気に入り または あとで見る
  created_at: string;
}
```

**ワーカー側**:
- 求人のお気に入り登録のみ（`entity_type: 'job'`, `type: 'favorite'`）
- ブックマーク機能は廃止
- 求人詳細ページには「あとで見る」ボタンあり（一時的な保存）

**施設側**:
- ワーカーのお気に入り登録（`entity_type: 'worker'`, `type: 'favorite'`）
- ワーカーのあとで見る（`entity_type: 'worker'`, `type: 'watch_later'`）

#### Messages（メッセージ）
```typescript
interface Message {
  id: number;
  from_user_id?: number;
  to_user_id?: number;
  from_facility_id?: number;
  to_facility_id?: number;
  application_id: number;   // どのマッチングに関するメッセージか
  content: string;
  read_at?: string;
  created_at: string;
}
```

**マッチング時の自動メッセージ送信**:
- 施設が応募を承認（`status: 'applied'` → `'scheduled'`）した際、施設の初回メッセージ設定を使用して自動的にメッセージを送信

---

## 4. 技術スタック

### 4.1 フロントエンド
- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
  - プライマリカラー: `#5bb485`（緑）
- **状態管理**: React useState/useContext
- **アイコン**: lucide-react

### 4.2 バックエンド（将来実装）
- Node.js + Express.js + PostgreSQL
- または Ruby on Rails
- または Django (Python)

### 4.3 データベース（将来実装）
- PostgreSQL（メインDB）
- Redis（キャッシュ、セッション）

### 4.4 認証（将来実装）
- JWT（JSON Web Token）
- OAuth 2.0（SNS連携）

### 4.5 インフラ（将来実装）
- AWS（EC2, RDS, S3, CloudFront）
- または Vercel + Supabase
- または Firebase

### 4.6 その他
- Google Maps API（地図表示）
- SendGrid（メール送信）
- Stripe（決済処理）

---

## 5. 画面仕様

### 5.1 ワーカー側画面

#### トップページ（求人一覧） `/` または `/job-list`

**画面構成**
- ヘッダー
  - タブ（全体/限定/指名）
  - フィルターエリア
    - 働ける日ボタン
    - 絞り込みボタン
    - 並び順ドロップダウン（近い順/時給順/締切が近い順）
  - 日付スライダー（今日から90日分）
- 求人カード一覧
  - 施設画像（128px高）
  - タグ（左上）、お気に入りアイコン（右上）
  - 施設名、★評価、レビュー数
  - 求人タイトル（2行まで）
  - 勤務時間、日給（赤文字）、時給（グレー）
  - 締切カウントダウン（赤背景）
  - 住所、アクセス
- 下部ナビゲーション（5つのメニュー）

**カラー**
- 選択中タブ: 緑 `#66cc99`
- 未選択タブ: グレー `#6b7280`
- 日給: 赤 `#ef4444`
- 締切背景: 赤 `#ef4444`

#### 求人詳細ページ `/jobs/[id]`

**タブナビゲーション**（ページ内タブ切り替え）
1. 仕事概要
2. 申込条件
3. 事前情報
4. レビュー

**ヘッダー**
- 戻るボタン
- あとで見るボタン（一時保存）

**コンテンツ**
- 画像カルーセル
- 施設基本情報
  - 施設名、評価、レビュー数
  - 住所、アクセス、地図
- お仕事カード（横スクロール）
  - 同じ施設の他の日程の求人
- 責任者情報
  - アバター、名前、メッセージ
- 仕事内容
  - 業務内容、タグ
- レビュー一覧
  - 総合評価、評価分布
  - 個別レビュー（年代、性別、職種、期間、良かった点、改善点）
- 申し込みボタン（固定フッター）

#### 仕事管理ページ `/my-jobs`

**タブ構成**
1. 勤務予定 (`scheduled`)
2. 勤務中 (`working`)
3. 評価待ち (`completed_pending`)
4. 評価済み (`completed_rated`)
5. キャンセル済み (`cancelled`)

**求人カード（コンパクト版）**
- 施設画像、施設名、評価
- 勤務日時
- 時給、交通費、総支給額（1行に3つ表示）
- アクションボタン
  - scheduled/working: キャンセル、メッセージ
  - completed_pending: 評価する、メッセージ
  - completed_rated/cancelled: メッセージのみ

**メッセージボタン機能**
- クリック時: `/messages?roomId={施設名}` に遷移
- メッセージページで自動的にその施設のチャットルームを開く

#### メッセージページ `/messages`

**タブ構成**
1. メッセージ
2. お知らせ

**メッセージタブ機能**
- 施設名検索（検索ボックス）
- ソート（リスト選択）
  - 新着順（最新メッセージのタイムスタンプ順）
  - 勤務日順（最後に働いた日付順）
- メッセージルーム一覧
  - 施設画像、施設名、評価
  - 最新メッセージプレビュー
  - 最終メッセージ日時
  - 未読バッジ

**URLパラメータ**
- `?roomId={facilityName}`: 直接特定施設のチャットを開く

**お知らせタブ**
- システムからのお知らせ一覧
- 検索・ソート機能なし

#### お気に入りページ `/favorites`

- お気に入り登録した求人一覧
- 求人カード表示
- フィルター・ソート機能

#### マイページ `/mypage`

- プロフィール表示・編集
- 資格情報管理
- 設定
  - 通知設定
  - アカウント設定

---

### 5.2 施設側画面

#### 施設管理ダッシュボード `/admin`

**サイドバーナビゲーション**
1. ダッシュボード
2. 求人管理
3. テンプレート管理
4. ワーカー管理
5. メッセージ
6. 施設情報
7. ログアウト

#### 求人管理 `/admin/jobs`

- 求人一覧（ステータス別フィルター）
- 新規求人作成ボタン
- 各求人の編集・削除・複製

#### 求人作成 `/admin/jobs/new`

- 施設選択（1施設のみなのでドロップダウン不要、自動選択）
- テンプレート選択（任意、全テンプレート表示）
- 勤務日時入力
- 募集人数、職種、業務内容
- 報酬、交通費
- 施設情報、画像
- 掲載期間設定
- プレビュー・公開

#### テンプレート管理 `/admin/jobs/templates`

- テンプレート一覧（全10テンプレート）
- 新規テンプレート作成ボタン
- 各テンプレートの編集・削除・複製

**テンプレート項目制限**
- スキル・経験: 5件まで
- 服装・身だしなみ: 5件まで
- 持ち物・その他: 5件まで

#### テンプレート作成 `/admin/jobs/templates/new`

- テンプレート名
- 求人タイトル
- 勤務時間（開始、終了、休憩）
- 時給、交通費
- 募集人数
- 必要資格
- 仕事内容
- スキル・経験（5件まで、各項目に入力フィールド＋追加ボタン）
- 服装・身だしなみ（5件まで）
- 持ち物・その他（5件まで）
- デフォルト画像設定（この施設の画像として使用）
- 備考
- タグ

#### テンプレート編集 `/admin/jobs/templates/[id]/edit`

- テンプレート作成と同じフォーム
- 5件制限の実装
  - 各配列フィールドに `disabled={formData.skills.length >= 5}` 等を追加
  - ラベルに「（5つまで入力可能）」を表示
  - `addToArray` 関数内で5件チェック

#### ワーカー管理 `/admin/workers`

- マッチング済みワーカー一覧（`applied` ステータスは除外）
- ステータスフィルター
  - scheduled（勤務予定）
  - working（勤務中）
  - completed_pending（評価待ち）
  - completed_rated（評価済み）
- ワーカー詳細
  - プロフィール、資格、経験
  - 勤務履歴
  - 評価・レビュー
- アクション
  - メッセージ送信
  - お気に入り登録
  - あとで見る登録
  - 評価する

#### メッセージページ `/admin/messages`

- ワーカーとのメッセージルーム一覧
- ワーカー検索機能
- マッチング時の自動メッセージ送信（施設の初回メッセージ設定を使用）

#### 施設情報管理 `/admin/facility`

- 施設基本情報編集
- 法人情報編集
- 施設画像管理
- 初回メッセージ設定
  - マッチング時に自動送信されるメッセージテンプレート

---

## 6. ワークフロー

### 6.1 応募〜勤務〜評価フロー

```
1. ワーカーが求人に応募
   → status: 'applied'

2. 施設が応募を承認
   → status: 'scheduled'
   → 施設の初回メッセージを自動送信

3. 勤務開始
   → status: 'working'

4. 勤務終了
   → status: 'completed_pending'
   → worker_review_status: 'pending'
   → facility_review_status: 'pending'

5a. ワーカーが施設を評価
   → worker_review_status: 'completed'

5b. 施設がワーカーを評価
   → facility_review_status: 'completed'

6. 両者の評価が完了
   → status: 'completed_rated'
```

### 6.2 プロフィール完成度チェック

応募時:
```
if (資格情報が未登録) {
  → プロフィール登録ページへリダイレクト
} else {
  → 応募確認画面へ進む
}
```

---

## 7. ビジネスモデル

### 7.1 収益源
- 施設からの掲載手数料
  - 求人掲載料：無料
  - 成約手数料：採用1件あたり◯◯円
  - または時給の◯%

### 7.2 ワーカーへの提供価値
- 無料で求人検索・応募可能
- 柔軟な働き方の実現
- 簡単な応募フロー
- 施設の評価・レビューで安心

### 7.3 施設への提供価値
- 短期・単発の人材確保
- 優良なスタッフの確保
- 簡単な求人掲載
- 応募者管理の効率化

---

## 8. 非機能要件

### 8.1 パフォーマンス
- ページ読み込み時間：3秒以内
- 同時アクセス数：10,000ユーザー
- データベースレスポンス：100ms以内

### 8.2 セキュリティ
- SSL/TLS通信の暗号化
- パスワードのハッシュ化
- 個人情報の適切な管理
- XSS、CSRF対策
- SQLインジェクション対策

### 8.3 可用性
- 稼働率：99.9%以上
- バックアップ：1日1回
- 障害時の復旧時間：4時間以内

### 8.4 保守性
- ログ記録・監視
- エラー通知
- 定期的なセキュリティアップデート

### 8.5 対応環境
- **ブラウザ**
  - Chrome（最新版）
  - Safari（最新版）
  - Firefox（最新版）
  - Edge（最新版）
- **デバイス**
  - PC（1280px以上）
  - タブレット（768px〜1279px）
  - スマートフォン（767px以下）
- **レスポンシブ対応必須**

---

**最終更新**: 2025-11-24
