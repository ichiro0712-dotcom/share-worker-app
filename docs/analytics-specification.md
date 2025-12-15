# システム管理アナリティクス機能仕様書

## 概要

システム管理者向けの詳細アナリティクス機能。ワーカー、施設、応募・マッチングの各種指標を期間・フィルター条件で分析可能。

---

## 1. タブ構成

| タブ名 | URL | 説明 |
|--------|-----|------|
| ワーカー分析 | `/system-admin/analytics?tab=worker` | ワーカーに関する指標 |
| 施設分析 | `/system-admin/analytics?tab=facility` | 施設に関する指標 |
| 応募・マッチング | `/system-admin/analytics?tab=matching` | 応募・マッチングに関する指標 |
| 地域登録 | `/system-admin/analytics/regions` | 分析用地域の登録・管理 |
| スプレッドシートDL | `/system-admin/analytics/export` | 指標データのエクスポート |
| AI予測 | `/system-admin/analytics/ai` | マッチング最適化AI（ダミー実装） |

---

## 2. 共通仕様

### 2.1 期間指定
- 開始日・終了日を選択（デフォルト: 空欄）
- 「更新」ボタンを押すとデータ取得

### 2.2 表示形式（日次/月次）
| モード | 表示内容 |
|--------|----------|
| 日次（デフォルト） | 選択した月の1日〜末日まで日ごとに表示 |
| 月次 | 選択した年の1月〜12月まで月ごとに表示 |

### 2.3 データ更新
- 毎朝5時にバッチ処理で集計テーブルを更新
- 画面では集計済みデータを参照（リアルタイム集計ではない）

---

## 3. ワーカー分析

### 3.1 指標一覧

| 指標名 | 説明 | 計算方法 |
|--------|------|----------|
| 登録ワーカー数 | 期間末時点での登録済みワーカー総数 | `User`テーブルのレコード数（退会除く） |
| 入会ワーカー数 | 期間中に新規登録したワーカー数 | `created_at`が期間内の`User`数 |
| 退会ワーカー数 | 期間中に退会したワーカー数 | ※退会フラグ/テーブル要追加 |
| ワーカーレビュー数 | 期間中に施設からワーカーへのレビュー数 | `Review`の`reviewer_type=FACILITY`数 |
| ワーカーレビュー点数 | 上記レビューの平均点 | `Review.rating`の平均 |
| ワーカーキャンセル率 | ワーカーによるキャンセル割合 | `Application.cancelled_by=WORKER` / 全応募数 |
| ワーカー直前キャンセル率 | 勤務日24時間以内のキャンセル割合 | ※直前キャンセルの定義: 勤務日24時間以内 |
| ワーカー登録離脱率 | 登録フロー開始〜完了までの離脱率 | ※登録開始イベントのトラッキング要追加 |
| ワーカー退会率 | 登録ワーカーに対する退会率 | 退会数 / 期間開始時の登録数 |

### 3.2 フィルター条件

| フィルター | 選択肢 |
|------------|--------|
| 年齢層 | 10代, 20代, 30代, 40代, 50代, 60代以上 |
| 保有資格 | DBの資格マスタ（`QUALIFICATION_OPTIONS`） |
| 地域 | 地域登録機能で登録した地域 |

### 3.3 表示レイアウト
- グラフなし（数値テーブルのみ）
- 日次: 横軸に日付、縦軸に各指標
- 月次: 横軸に月、縦軸に各指標

---

## 4. 施設分析

### 4.1 指標一覧

| 指標名 | 説明 | 計算方法 |
|--------|------|----------|
| 登録施設数 | 期間末時点での登録済み施設総数 | `Facility`テーブルのレコード数 |
| 入会施設数 | 期間中に新規登録した施設数 | `created_at`が期間内の`Facility`数 |
| 退会施設数 | 期間中に退会した施設数 | ※退会フラグ/テーブル要追加 |
| 施設レビュー数 | 期間中にワーカーから施設へのレビュー数 | `Review`の`reviewer_type=WORKER`数 |
| 施設レビュー点数 | 上記レビューの平均点 | `Review.rating`の平均 |
| 施設登録離脱率 | 登録フロー開始〜完了までの離脱率 | ※登録開始イベントのトラッキング要追加 |
| 施設退会率 | 登録施設に対する退会率 | 退会数 / 期間開始時の登録数 |
| 親求人数 | 期間中に作成された親求人数 | `Job`テーブルのレコード数 |
| 親求人数（審査あり） | 上記のうち審査ありの数 | `Job.requires_interview=true` |
| 子求人数 | 期間中に作成された子求人数 | `JobWorkDate`テーブルのレコード数 |
| 子求人数（審査あり） | 上記のうち審査ありの数 | 親Jobの`requires_interview=true` |

### 4.2 フィルター条件

| フィルター | 選択肢 |
|------------|--------|
| 施設種類 | デイサービス, 訪問看護, 特別養護老人ホーム, グループホーム, 介護老人保健施設, 小規模多機能型居宅介護, 有料老人ホーム, サービス付き高齢者向け住宅, ショートステイ, 訪問介護 |
| 地域 | 地域登録機能で登録した地域 |

---

## 5. 応募・マッチング分析

### 5.1 指標一覧

| 指標名 | 説明 | カテゴリ |
|--------|------|----------|
| 親求人数 | 期間中の親求人数 | 施設 |
| 子求人数 | 期間中の子求人数 | 施設 |
| 応募数 | 期間中の応募数 | 共通 |
| マッチング数 | 期間中のマッチング成立数 | 共通 |
| マッチング期間 | 求人公開〜応募枠が埋まるまでの平均時間 | 共通 |
| ワーカーあたり応募数 | 1ワーカーあたりの平均応募数 | ワーカー |
| ワーカーあたりマッチング数 | 1ワーカーあたりの平均マッチング数 | ワーカー |
| ワーカーあたりレビュー数 | 1ワーカーあたりの平均レビュー数 | ワーカー |
| 施設あたり親求人数 | 1施設あたりの平均親求人数 | 施設 |
| 施設あたり子求人数 | 1施設あたりの平均子求人数 | 施設 |
| 施設あたりマッチング数 | 1施設あたりの平均マッチング数 | 施設 |
| 施設あたりレビュー数 | 1施設あたりの平均レビュー数 | 施設 |

### 5.2 フィルター条件

| フィルター | 選択肢 |
|------------|--------|
| 年齢層 | 10代, 20代, 30代, 40代, 50代, 60代以上 |
| 保有資格 | DBの資格マスタ |
| 施設種類 | 施設種類一覧 |
| 地域 | 地域登録機能で登録した地域 |
| 審査あり | あり / なし / すべて |

### 5.3 条件付き表示ロジック

フィルター選択に応じて、意味のない指標は非表示にする:

| フィルター | 非表示になる指標 |
|------------|------------------|
| 年齢層のみ | 親求人数, 子求人数, 施設あたり親求人数, 施設あたり子求人数 |
| 保有資格のみ | 親求人数, 子求人数, 施設あたり親求人数, 施設あたり子求人数 |
| 施設種類のみ | ワーカーあたり応募数, ワーカーあたりマッチング数, ワーカーあたりレビュー数 |
| 年齢層 + 施設種類 | 両方の非表示指標を適用 |
| 審査ありのみ | なし（すべて表示） |

**ルール**: ワーカー属性フィルター → 施設系指標を非表示、施設属性フィルター → ワーカー系指標を非表示

---

## 6. 地域登録機能

### 6.1 URL
`/system-admin/analytics/regions`

### 6.2 機能
- 地域の追加・編集・削除
- 都道府県 + 市区町村の組み合わせで登録
- 登録した地域は各分析画面のフィルターで選択可能

### 6.3 データモデル
```prisma
model AnalyticsRegion {
  id          Int      @id @default(autoincrement())
  name        String   // 表示名（例: "東京都心部"）
  prefectures String[] // 都道府県リスト
  cities      String[] // 市区町村リスト（オプション）
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@map("analytics_regions")
}
```

---

## 7. スプレッドシートDL機能

### 7.1 URL
`/system-admin/analytics/export`

### 7.2 機能
- 期間指定（開始日・終了日）
- 出力指標の選択（チェックボックス）
  - ワーカー分析の全指標
  - 施設分析の全指標
  - 応募・マッチング分析の全指標
- フィルター条件の指定
- CSV/Excelダウンロード

### 7.3 UI
1. 期間選択
2. 指標カテゴリ選択（ワーカー/施設/マッチング）
3. 個別指標のチェックボックス
4. フィルター条件
5. ダウンロードボタン

---

## 8. マッチング最適化AI機能

### 8.1 URL
`/system-admin/analytics/ai`

### 8.2 機能（Phase 1 - ダミー実装）
- 入力フォーム:
  - 施設数
  - 求人数
  - ワーカー数
  - マッチング期間
  - マッチング数
  （上記から1つ以上を入力）
- 「予測する」ボタン
- 結果表示エリア: ダミーデータを表示
- 注意書き: 「LLM接続が未実装です」

### 8.3 将来実装
- LLM API（Claude等）と接続
- 過去データを分析し、入力値から他の項目を予測

---

## 9. DBスキーマ追加

### 9.1 新規テーブル

```prisma
// 分析用地域マスタ
model AnalyticsRegion {
  id          Int      @id @default(autoincrement())
  name        String
  prefectures String[]
  cities      String[]
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@map("analytics_regions")
}

// 集計データキャッシュ（日次）
model AnalyticsDailyCache {
  id              Int      @id @default(autoincrement())
  date            DateTime @unique
  metric_type     String   // "worker", "facility", "matching"
  data            Json     // 集計データ
  filters         Json?    // フィルター条件（null = 全体）
  created_at      DateTime @default(now())

  @@index([date, metric_type])
  @@map("analytics_daily_cache")
}

// 登録離脱トラッキング（将来用）
model RegistrationTracking {
  id              Int      @id @default(autoincrement())
  session_id      String   @unique
  user_type       String   // "worker", "facility"
  started_at      DateTime
  completed_at    DateTime?
  last_step       String?  // 最後に完了したステップ
  created_at      DateTime @default(now())

  @@map("registration_tracking")
}
```

### 9.2 既存テーブル修正

```prisma
// User に退会情報を追加
model User {
  // ... existing fields ...
  deleted_at     DateTime?  @map("deleted_at")  // 退会日時
  delete_reason  String?    @map("delete_reason") // 退会理由
}

// Facility に退会情報を追加
model Facility {
  // ... existing fields ...
  deleted_at     DateTime?  @map("deleted_at")
  delete_reason  String?    @map("delete_reason")
}
```

---

## 10. ファイル構成

```
app/system-admin/analytics/
├── page.tsx                    # メインページ（タブ切替）
├── tabs/
│   ├── WorkerAnalytics.tsx     # ワーカー分析タブ
│   ├── FacilityAnalytics.tsx   # 施設分析タブ
│   └── MatchingAnalytics.tsx   # 応募・マッチング分析タブ
├── regions/
│   └── page.tsx                # 地域登録ページ
├── export/
│   └── page.tsx                # スプレッドシートDLページ
└── ai/
    └── page.tsx                # AI予測ページ

src/lib/
├── analytics-actions.ts        # 分析用Server Actions（既存拡張）
└── analytics-batch.ts          # バッチ処理（5時集計）

components/system-admin/
└── analytics/
    ├── DateRangeFilter.tsx     # 期間選択コンポーネント
    ├── AnalyticsFilters.tsx    # フィルターコンポーネント
    ├── MetricsTable.tsx        # 指標テーブルコンポーネント
    └── ExportForm.tsx          # エクスポートフォーム
```

---

## 11. 実装優先度

### Phase 1（必須）
1. ワーカー分析タブ
2. 施設分析タブ
3. 応募・マッチング分析タブ
4. 日次/月次切替
5. 期間指定

### Phase 2（次点）
1. フィルター機能（年齢、資格、施設種類、地域）
2. 地域登録機能
3. 条件付き表示ロジック

### Phase 3（追加）
1. スプレッドシートDL機能
2. AI予測（ダミー）
3. バッチ処理（5時集計）
4. 登録離脱トラッキング

---

## 12. 未実装・要検討事項

| 項目 | 状態 | 備考 |
|------|------|------|
| 退会機能 | 未実装 | User/Facilityに`deleted_at`追加必要 |
| 登録離脱トラッキング | 未実装 | 登録フローにイベント発火追加必要 |
| 直前キャンセルの定義 | 要確認 | 24時間以内でOK？ |
| バッチ処理の実行環境 | 要検討 | cron, Vercel Cron, 外部サービス |
