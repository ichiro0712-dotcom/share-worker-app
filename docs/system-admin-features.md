# システム管理者機能 - 詳細要件定義書

> **作成日**: 2025-12-04
> **最終更新**: 2025-12-09
> **ステータス**: 確定（実装準備完了）
> **優先度**: 高（必須）

---

## 1. 概要

+TASTASプラットフォーム全体を管理するシステム管理者向け機能。
ワーカー・施設・求人・レビュー・メッセージの監視、分析、システム設定を行う。

### 1.1 ユーザーロール階層

| レベル | ロール | 認証方式 | 管理範囲 |
|--------|--------|---------|---------|
| Level 1 | ワーカー | NextAuth (JWT) | 自分のプロフィール・応募 |
| Level 2 | 施設管理者 | Cookie (`admin_session`) | 自施設の求人・応募管理 |
| **Level 3** | **システム管理者** | **新規実装（Cookie）** | **システム全体** |

---

## 2. ダッシュボード

### 2.1 統計サマリー（トップページ）
| 項目 | 表示内容 |
|------|---------|
| ワーカー | 総数、今日/今週/今月の新規、アクティブ率 |
| 施設 | 総数、今日/今週/今月の新規 |
| 求人 | 公開中、本日締切、マッチング待ち |
| 応募 | 本日応募数、マッチング数、キャンセル数 |
| アラート | 異常値検知（後述） |

### 2.2 最近の活動
- 直近のワーカー登録
- 直近の施設登録
- 直近の応募
- 直近のレビュー

---

## 3. アナリティクス

### 3.1 基本統計

#### ワーカー統計
| 指標 | 説明 | フィルター |
|------|------|-----------|
| 登録ワーカー数 | 累計登録者数 | 期間（毎日/月間/任意）、性別、年齢、保有資格 |
| 入会ワーカー数 | 新規登録者数 | 同上 |
| 退会ワーカー数 | 退会者数 | 同上 |

#### 施設統計
| 指標 | 説明 | フィルター |
|------|------|-----------|
| 登録施設数 | 累計施設数 | 期間（毎日/月間/任意）、施設種別 |
| 入会施設数 | 新規登録施設数 | 同上 |
| 退会施設数 | 退会施設数 | 同上 |

#### 求人統計
| 指標 | 説明 | フィルター |
|------|------|-----------|
| 親求人数（Job） | ステータス別（公開中/下書き/終了） | 期間、施設種別、審査あり |
| 子求人数（JobWorkDate） | ステータス別（公開中/締切済/終了） | 同上 |

#### マッチング統計
| 指標 | 説明 | フィルター |
|------|------|-----------|
| 応募数 | Application作成数 | 期間、性別、年齢、保有資格、施設種別、審査あり |
| マッチング数 | status=SCHEDULED以降 | 同上 |
| マッチング期間 | 求人公開→応募充足の平均時間 | 期間、施設種別、審査あり |

#### レビュー統計
| 指標 | 説明 | フィルター |
|------|------|-----------|
| ワーカーレビュー数 | reviewer_type=FACILITY | 期間、性別、年齢、保有資格 + 平均★表示 |
| 施設レビュー数 | reviewer_type=WORKER | 期間、施設種別 + 平均★表示 |

### 3.2 率・パフォーマンス指標

#### ワーカー関連
| 指標 | 説明 | フィルター |
|------|------|-----------|
| ワーカー登録離脱率 | 登録開始→完了しなかった率 | 期間 |
| ワーカー退会率 | 退会者/累計登録者 | 期間 |
| ワーカーあたり応募数 | 応募総数/アクティブワーカー数 | 期間、性別、年齢、保有資格 |
| ワーカーあたりマッチング数 | マッチング数/アクティブワーカー数 | 同上 |
| ワーカーあたりレビュー数 | レビュー数/アクティブワーカー数 | 同上 |

#### 施設関連
| 指標 | 説明 | フィルター |
|------|------|-----------|
| 施設登録離脱率 | 登録開始→完了しなかった率 | 期間 |
| 施設退会率 | 退会施設/累計施設 | 期間 |
| 施設あたり親求人数 | 親求人数/施設数 | 期間、施設種別、審査あり |
| 施設あたり子求人数 | 子求人数/施設数 | 同上 |
| 施設あたりマッチング数 | マッチング数/施設数 | 同上 |
| 施設あたりレビュー数 | 受けたレビュー数/施設数 | 同上 |

### 3.3 分析機能

#### 地域分析
- 事前設定した地域区分（例: 関東、関西、中部など）でグルーピング
- 全アナリティクスを地域別に表示可能

#### 施設検索（求人数ベース）
- 指定期間内の施設あたり求人数で検索
- 例: 「過去30日で求人1〜5件の施設一覧」
- 用途: 休眠施設の発見、アクティブ施設の特定

#### 施設検索（マッチング時間ベース）
- 指定期間内の平均マッチング時間で検索
- 例: 「過去30日で平均12〜48時間の施設一覧」
- 用途: マッチング効率の良い/悪い施設の特定

#### マッチング最適化AI（予測機能）
過去データを分析し、以下の項目を入力すると他の項目を予測：
- **入力可能項目**（複数選択可）: 施設数、求人数、ワーカー数、マッチング期間、マッチング数
- **出力**: 入力した以外の項目の予測値
- **例**: 「施設数100、求人数500を入力 → 必要ワーカー数、予想マッチング数、予想マッチング期間を算出」

### 3.4 エクスポート機能
- 全アナリティクスデータをCSV/Excelでダウンロード可能
- フィルター適用後のデータもエクスポート可能

---

## 4. ワーカー管理

### 4.1 ワーカー検索・一覧
| 機能 | 説明 |
|------|------|
| 一覧表示 | ページネーション付き |
| 検索 | 名前、メール、電話番号、資格 |
| ソート | 登録日、最終ログイン、応募数、マッチング数、評価 |
| フィルター | ステータス、資格、地域、評価範囲 |
| **一括操作** | 複数選択 → 一括ステータス変更（停止/再開） |
| **エクスポート** | 一覧をCSV/Excelでダウンロード |

### 4.2 ワーカー詳細
既存画面 `/admin/workers/` と同様の表示に加え:

| 追加機能 | 説明 |
|------|------|
| マイページ閲覧 | ワーカーのマイページを管理者視点で閲覧 |
| 仕事管理閲覧 | 応募履歴、マッチング履歴、勤務履歴を閲覧 |
| 強制編集 | プロフィール、資格情報などを管理者が編集可能 |
| アカウント停止/再開 | ワーカーのログイン可否を切り替え |

### 4.3 ワーカーページリンク
- システム管理者（PC）からワーカー向けページ（スマホUI）を閲覧可能
- 用途: サポート対応時に実際の画面を確認

### 4.4 ワーカー退会機能
- ワーカー側から退会申請が可能
- 退会時: status=DELETEDに変更、deleted_atを記録
- 関連データは論理削除（物理削除はしない）

---

## 5. 施設管理

### 5.1 施設検索・一覧
| 機能 | 説明 |
|------|------|
| 一覧表示 | ページネーション付き |
| 検索 | 施設名、法人名、住所、電話番号 |
| ソート | 登録日、求人数、マッチング数、評価 |
| フィルター | 施設種別、地域、公開/非公開状態 |
| **一括操作** | 複数選択 → 一括ステータス変更（停止/再開/公開/非公開） |
| **エクスポート** | 一覧をCSV/Excelでダウンロード |

### 5.2 施設詳細・管理
| 機能 | 説明 |
|------|------|
| 施設管理画面代理ログイン | システム管理者が施設管理画面に入れる |
| 公開/非公開切り替え | 施設を検索から除外 |
| 新規施設登録 | システム管理者側から施設を新規作成 |
| **パスワードリセット** | 施設管理者のパスワードを強制リセット（新パスワードをメール送信） |

### 5.3 マップピン位置調整
- 施設の地図マーカー位置の微調整機能
- 方向ボタンによる緯度経度の調整（小/中/大の3段階）
- コンポーネント実装済み: `components/admin/MapPinAdjustModal.tsx`

### 5.4 施設退会機能
- 施設管理者側から退会申請が可能
- 退会時: status=DELETEDに変更、deleted_atを記録
- 関連する求人は自動的に非公開化
- 関連データは論理削除（物理削除はしない）

---

## 6. 求人管理

### 6.1 求人URL検索
- 求人のURL（例: `/jobs/123`）を入力 → その求人に対して操作
- 強制非公開: ステータスをSTOPPEDに変更
- 削除: 求人データを削除（または論理削除）

### 6.2 テンプレート管理
| 機能 | 説明 |
|------|------|
| 一覧表示 | 全施設のテンプレートを検索・表示 |
| 検索 | テンプレート名、施設名、キーワード |
| ソート | 作成日、使用回数 |
| 削除 | テンプレートを削除 |
| 強制編集 | テンプレート内容を管理者が編集 |

### 6.3 求人巡回機能（AI監視）
| 項目 | 説明 |
|------|------|
| 実行タイミング | 毎日（定時バッチ） |
| 対象 | 公開中の全求人 |
| AI判定 | 不適切な表現、法令違反の可能性、ガイドライン違反を検出 |
| プロンプト設定 | 「こういう求人を抽出して」を管理者が設定可能 |
| 出力 | 不適切求人の一覧 |
| アクション | 人間が確認 → 強制非公開 or 削除 |

### 6.4 テンプレート承認機能（AI判定）
| 項目 | 説明 |
|------|------|
| トリガー | 施設がテンプレートを新規登録/更新 |
| AI判定結果 | OK（自動承認）/ 修正（自動修正提案）/ 確認（人間が確認） |
| プロンプト設定 | 「こういうのがダメ」を管理者が設定可能 |
| 巡回 | 既存の承認済みテンプレートも毎日巡回し、怪しいものは「確認」に回す |

---

## 7. 応募管理

### 7.1 応募検索・一覧
| 機能 | 説明 |
|------|------|
| 一覧表示 | 全応募を検索・表示 |
| 検索 | ワーカー名、施設名、求人タイトル |
| ソート | 応募日、勤務日、ステータス |
| フィルター | ステータス、施設種別、期間 |
| **エクスポート** | 一覧をCSV/Excelでダウンロード |

### 7.2 応募ステータス強制変更
- APPLIED ↔ SCHEDULED ↔ WORKING ↔ COMPLETED_PENDING ↔ COMPLETED_RATED ↔ CANCELLED
- 用途: トラブル対応、手動でのステータス修正

---

## 8. レビュー管理

### 8.1 レビュー検索・一覧
| 機能 | 説明 |
|------|------|
| 一覧表示 | 全レビューを検索・表示 |
| 検索 | 投稿者名、施設名、キーワード |
| ソート | 投稿日、評価 |
| フィルター | reviewer_type、評価範囲 |
| 削除 | レビューを削除 |
| 編集 | レビュー内容を管理者が編集 |

### 8.2 レビュー巡回機能（AI監視）
| 項目 | 説明 |
|------|------|
| 実行タイミング | 毎日（定時バッチ） |
| 対象 | 全レビュー |
| AI判定結果 | OK / 修正 / 確認 |
| プロンプト設定 | 「こういうのがダメ」を管理者が設定可能 |
| アクション | 確認リストに追加 → 人間が対応 |

---

## 9. メッセージ管理

### 9.1 NGワード設定
- NGワードリストを管理
- メッセージ送信時にチェック（警告 or ブロック）

### 9.2 メッセージ巡回機能（AI監視）
| 項目 | 説明 |
|------|------|
| 実行タイミング | 毎日（定時バッチ） |
| 対象 | 全メッセージ |
| AI判定 | 不適切な内容、ハラスメント、外部誘導などを検出 |
| プロンプト設定 | 管理者が検出条件を設定可能 |
| アクション | 一覧抽出 → 人間が確認 → 非公開/削除 |

---

## 10. コンテンツ管理

### 10.1 お知らせ管理
- 作成、編集、公開/非公開
- 対象: ワーカー向け、施設向け、両方
- 表示期間の設定

### 10.2 FAQ編集
- カテゴリ管理
- Q&A作成、編集、並び替え

### 10.3 利用規約・プライバシーポリシー編集
- WYSIWYG or Markdownエディタ
- バージョン管理
- 更新時の通知設定

### 10.4 労働条件通知書テンプレート編集
- 現在のテンプレート: `components/admin/LaborDocumentPreviewModal.tsx`
- 文言の編集可能に

### 10.5 テンプレート管理（共通テンプレート）

#### 仕事詳細フォーマット
- `/admin/jobs/new` で使用されるフォーマット定義
- 項目の追加/削除/並び替え

#### メール通知テンプレート
| 通知種別 | 説明 |
|---------|------|
| 応募確認メール | ワーカーが応募時に送信 |
| マッチング成立メール | マッチング時に双方に送信 |
| 勤務リマインドメール | 勤務前日/当日 |
| レビュー依頼メール | 勤務完了後 |
| アカウント関連メール | 登録完了、パスワードリセットなど |

### 10.6 通知管理
- どのタイミングで、どんな通知が、どこに表示されるかの一覧
- プッシュ通知、アプリ内通知、メール通知の設定

---

## 11. システム設定

### 11.1 サイト基本設定
- サイト名称
- ロゴ画像
- 連絡先（メール、電話）
- フッター情報

### 11.2 マスタ管理

#### 求人カテゴリ・サービス種別マスタ
- DB管理に移行して動的に変更可能に

#### 資格マスタ
- DB管理に移行

#### 地域マスタ
- 都道府県、市区町村
- 地域グループ（関東、関西など）の定義

### 11.3 メール配信設定
- SMTPサーバー設定
- 送信元アドレス
- テスト送信機能

### 11.4 キャンセルポリシー設定
- キャンセル率に反映される条件
- 直前キャンセルの定義
- ペナルティ閾値

### 11.5 評価・ペナルティ設定
- 低評価の定義（何点以下か）
- ペナルティ発動条件
- ペナルティ内容（警告、機能制限、停止、凍結）

---

## 12. アラート機能

### 12.1 アラート条件設定
| アラート種別 | 条件例 | 通知先 |
|-------------|-------|-------|
| キャンセル率急増 | 特定ワーカーのキャンセル率が閾値超え | システム管理者 |
| 低評価連続 | 特定ワーカー/施設が連続低評価 | システム管理者 |
| 新規登録急増 | 1日の新規登録が通常の2倍以上 | システム管理者 |
| マッチング遅延 | 特定施設のマッチング時間が閾値超え | システム管理者 |
| 不審アクティビティ | 短時間に大量の操作 | システム管理者 |

### 12.2 アラート表示
- ダッシュボードにアラート一覧を表示
- 未対応/対応済みのステータス管理
- アラートからワンクリックで詳細画面へ遷移

---

## 13. セキュリティ

### 13.1 システム管理者アカウント管理
| 機能 | 説明 |
|------|------|
| アカウント一覧 | システム管理者の一覧 |
| 新規作成 | 新しい管理者を追加 |
| 権限設定 | Super Admin / Admin / Viewer |
| パスワードリセット | 他の管理者のパスワードをリセット |
| アカウント停止/削除 | 管理者を無効化 |

### 13.2 操作ログ
| 対象 | 記録内容 |
|------|---------|
| システム管理者ページ | ログイン日時、操作内容（誰が何をしたか） |
| 施設管理者ページ | ログイン日時、操作内容 |
| 追加情報 | IPアドレス、User-Agent、失敗したログイン試行 |

---

## 14. DB拡張案

### 14.1 新規テーブル

```prisma
// システム管理者
model SystemAdmin {
  id            Int      @id @default(autoincrement())
  email         String   @unique
  password_hash String   @map("password_hash")
  name          String
  role          SystemAdminRole @default(ADMIN)
  is_active     Boolean  @default(true)
  created_at    DateTime @default(now()) @map("created_at")
  updated_at    DateTime @updatedAt @map("updated_at")

  @@map("system_admins")
}

enum SystemAdminRole {
  SUPER_ADMIN  // 全機能アクセス
  ADMIN        // 基本操作
  VIEWER       // 閲覧のみ

  @@map("system_admin_role")
}

// 操作ログ
model AuditLog {
  id            Int      @id @default(autoincrement())
  admin_type    String   @map("admin_type") // 'system' | 'facility'
  admin_id      Int      @map("admin_id")
  action        String   // 'login' | 'update' | 'delete' | etc
  target_type   String?  @map("target_type") // 'user' | 'facility' | 'job' | etc
  target_id     Int?     @map("target_id")
  details       Json?
  ip_address    String?  @map("ip_address")
  user_agent    String?  @map("user_agent")
  created_at    DateTime @default(now()) @map("created_at")

  @@map("audit_logs")
}

// AI巡回結果
model ContentReview {
  id            Int                 @id @default(autoincrement())
  content_type  String              @map("content_type") // 'job' | 'template' | 'review' | 'message'
  content_id    Int                 @map("content_id")
  status        ContentReviewStatus @default(PENDING)
  ai_result     String              @map("ai_result") // 'OK' | 'MODIFY' | 'CHECK'
  ai_reason     String?             @map("ai_reason")
  reviewed_by   Int?                @map("reviewed_by")
  reviewed_at   DateTime?           @map("reviewed_at")
  created_at    DateTime            @default(now()) @map("created_at")
  updated_at    DateTime            @updatedAt @map("updated_at")

  @@map("content_reviews")
}

enum ContentReviewStatus {
  PENDING      // 未確認
  APPROVED     // 承認
  REJECTED     // 却下
  MODIFIED     // 修正済み

  @@map("content_review_status")
}

// お知らせ
model Announcement {
  id            Int       @id @default(autoincrement())
  title         String
  content       String
  target        String    // 'worker' | 'facility' | 'both'
  is_published  Boolean   @default(false) @map("is_published")
  published_at  DateTime? @map("published_at")
  expires_at    DateTime? @map("expires_at")
  created_by    Int       @map("created_by")
  created_at    DateTime  @default(now()) @map("created_at")
  updated_at    DateTime  @updatedAt @map("updated_at")

  @@map("announcements")
}

// FAQ
model Faq {
  id            Int      @id @default(autoincrement())
  category      String
  question      String
  answer        String
  sort_order    Int      @default(0) @map("sort_order")
  is_published  Boolean  @default(true) @map("is_published")
  created_at    DateTime @default(now()) @map("created_at")
  updated_at    DateTime @updatedAt @map("updated_at")

  @@map("faqs")
}

// NGワード
model NgWord {
  id            Int      @id @default(autoincrement())
  word          String   @unique
  action        String   // 'warn' | 'block'
  created_at    DateTime @default(now()) @map("created_at")

  @@map("ng_words")
}

// マスタ（動的管理用）
model MasterData {
  id            Int      @id @default(autoincrement())
  category      String   // 'service_type' | 'qualification' | 'region' etc
  value         String
  label         String
  sort_order    Int      @default(0) @map("sort_order")
  is_active     Boolean  @default(true) @map("is_active")
  created_at    DateTime @default(now()) @map("created_at")
  updated_at    DateTime @updatedAt @map("updated_at")

  @@unique([category, value])
  @@map("master_data")
}

// システム設定
model SystemSetting {
  id            Int      @id @default(autoincrement())
  key           String   @unique
  value         Json
  description   String?
  updated_by    Int?     @map("updated_by")
  updated_at    DateTime @updatedAt @map("updated_at")

  @@map("system_settings")
}

// AI巡回プロンプト設定
model AiPromptSetting {
  id            Int      @id @default(autoincrement())
  type          String   // 'job_review' | 'template_approval' | 'review_check' | 'message_check'
  prompt        String
  is_active     Boolean  @default(true) @map("is_active")
  created_at    DateTime @default(now()) @map("created_at")
  updated_at    DateTime @updatedAt @map("updated_at")

  @@map("ai_prompt_settings")
}

// アラート
model Alert {
  id            Int         @id @default(autoincrement())
  type          String      // 'cancel_rate' | 'low_rating' | 'suspicious_activity' etc
  severity      String      // 'info' | 'warning' | 'critical'
  target_type   String?     @map("target_type") // 'user' | 'facility' | 'job'
  target_id     Int?        @map("target_id")
  message       String
  details       Json?
  status        AlertStatus @default(PENDING)
  resolved_by   Int?        @map("resolved_by")
  resolved_at   DateTime?   @map("resolved_at")
  created_at    DateTime    @default(now()) @map("created_at")

  @@map("alerts")
}

enum AlertStatus {
  PENDING     // 未対応
  RESOLVED    // 対応済み
  IGNORED     // 無視

  @@map("alert_status")
}
```

### 14.2 既存テーブル拡張

```prisma
// User に追加
model User {
  // 既存フィールド...

  // 追加
  status               UserStatus @default(ACTIVE)
  deleted_at           DateTime?  @map("deleted_at") // 論理削除用
  registration_step    Int?       @map("registration_step") // 登録ステップ（1,2,3...完了時null）
  registration_started DateTime?  @map("registration_started") // 登録開始日時
}

enum UserStatus {
  PENDING   // 登録途中
  ACTIVE    // 有効
  SUSPENDED // 停止
  DELETED   // 退会

  @@map("user_status")
}

// Facility に追加
model Facility {
  // 既存フィールド...

  // 追加
  status               FacilityStatus @default(ACTIVE)
  region               String?        // 地域グループ
  deleted_at           DateTime?      @map("deleted_at") // 論理削除用
  registration_step    Int?           @map("registration_step")
  registration_started DateTime?      @map("registration_started")
}

enum FacilityStatus {
  PENDING   // 審査待ち
  ACTIVE    // 有効
  SUSPENDED // 停止
  DELETED   // 退会

  @@map("facility_status")
}
```

---

## 15. 画面一覧

| パス | 画面名 | 説明 |
|------|--------|------|
| `/system-admin/login` | ログイン | システム管理者ログイン |
| `/system-admin` | ダッシュボード | 統計サマリー・アラート |
| `/system-admin/analytics` | アナリティクス | 詳細統計・分析・エクスポート |
| `/system-admin/workers` | ワーカー管理 | 一覧・検索・一括操作 |
| `/system-admin/workers/[id]` | ワーカー詳細 | 詳細・編集・停止 |
| `/system-admin/facilities` | 施設管理 | 一覧・検索・一括操作 |
| `/system-admin/facilities/[id]` | 施設詳細 | 詳細・編集・停止 |
| `/system-admin/facilities/[id]/map` | マップピン調整 | 地図マーカー位置調整 |
| `/system-admin/jobs` | 求人管理 | URL検索・監視結果 |
| `/system-admin/templates` | テンプレート管理 | 一覧・承認・編集 |
| `/system-admin/applications` | 応募管理 | 一覧・ステータス変更 |
| `/system-admin/reviews` | レビュー管理 | 一覧・監視結果 |
| `/system-admin/messages` | メッセージ管理 | NGワード・監視結果 |
| `/system-admin/content` | コンテンツ管理 | お知らせ・FAQ |
| `/system-admin/settings` | システム設定 | マスタ・ポリシー |
| `/system-admin/alerts` | アラート管理 | アラート一覧・対応 |
| `/system-admin/security` | セキュリティ | アカウント・ログ |

---

## 16. 実装フェーズ

### Phase 1: 基盤構築（必須）
- [ ] DB拡張（User/Facilityにstatus, deleted_at, registration_step追加）
- [ ] SystemAdminテーブル作成
- [ ] 認証システム（SystemAdmin + ログイン）
- [ ] ダッシュボード（基本統計）
- [ ] ワーカー管理（一覧・詳細・停止・一括操作）
- [ ] 施設管理（一覧・詳細・停止・一括操作）
- [ ] ワーカー退会機能
- [ ] 施設退会機能
- [ ] 登録離脱率トラッキング

### Phase 2: 運用機能（必須）
- [ ] 求人管理（URL検索・非公開・削除）
- [ ] テンプレート管理（一覧・編集）
- [ ] 応募管理（一覧・ステータス変更）
- [ ] 操作ログ
- [ ] エクスポート機能（CSV/Excel）

### Phase 3: 監視・分析（重要）
- [ ] アナリティクス（詳細統計）
- [ ] レビュー管理
- [ ] メッセージ管理（NGワード）
- [ ] アラート機能

### Phase 4: AI機能（オプション）
- [ ] 求人巡回AI
- [ ] テンプレート承認AI
- [ ] レビュー巡回AI
- [ ] メッセージ巡回AI
- [ ] マッチング最適化AI（予測機能）

### Phase 5: 拡張機能（将来）
- [ ] コンテンツ管理（お知らせ・FAQ）
- [ ] マスタ管理（動的設定）
- [ ] 通知管理

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-12-04 | 初版作成。要件メモとして整理 |
| 2025-12-05 | マップピン位置調整機能を追加 |
| 2025-12-09 | 詳細要件定義書として大幅拡充。アナリティクス、AI監視機能、DB設計案を追加 |
| 2025-12-09 | 確定版。マッチング最適化AI（予測機能）、ダッシュボード、エクスポート機能、一括操作、アラート機能、退会機能、登録離脱率トラッキングを追加。パスワード表示機能は削除（リセット機能のみ） |
