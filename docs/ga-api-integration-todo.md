# Google Analytics API連携 - 作業メモ

## ステータス: API連携完了（基盤構築済み）

## 目的
GA4のデータをAPI/CLI経由で取得・確認・連携できるようにする。
PV数、ユーザー数、流入経路の自動取得、LP別コンバージョン分析の自動化など。

## 判明済み情報

| 項目 | 値 |
|------|---|
| GA4プロパティ名 | 【タスタス】tastas.work_広告配信用 |
| GA4プロパティID | 522574288 |
| GA4測定ID | G-BR5H1Z2Q0J |
| GTM ID | GTM-MSBWVNVB |
| サービスアカウント | tastas-api-user@tastas-488506.iam.gserviceaccount.com |
| プロジェクトID | tastas-488506 |

## 完了済み作業

### システム管理者側（完了）
- [x] Google Cloud ConsoleでGoogle Analytics Data API有効化
- [x] Google Cloud ConsoleでGoogle Analytics Admin API有効化
- [x] サービスアカウント作成 + JSON鍵ファイル発行
- [x] GA4プロパティにサービスアカウントを追加

### 開発側（完了）
- [x] `.gitignore` に `credentials/` 追加
- [x] `credentials/ga-service-account.json` 配置
- [x] `.env.local` に環境変数追加 (`GA4_PROPERTY_ID`, `GOOGLE_APPLICATION_CREDENTIALS`)
- [x] `@google-analytics/data` パッケージインストール
- [x] GA4クライアントユーティリティ実装 (`src/lib/ga-client.ts`)
- [x] GA4データ取得APIルート実装 (`app/api/ga-analytics/route.ts`)
- [x] 接続テストスクリプト実装 (`scripts/test-ga4-connection.ts`)
- [x] 接続テスト成功（2026-02-25確認）

## 実装済みファイル

| ファイル | 用途 |
|---------|------|
| `credentials/ga-service-account.json` | サービスアカウント鍵（.gitignore済み） |
| `src/lib/ga-client.ts` | GA4 APIクライアント + レポート取得関数 |
| `app/api/ga-analytics/route.ts` | GA4データ取得APIエンドポイント（認証付き） |
| `scripts/test-ga4-connection.ts` | 接続テストスクリプト |

## APIエンドポイント

```
GET /api/ga-analytics?reportType=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

| reportType | 説明 | 日付必須 |
|-----------|------|---------|
| `test` | 接続テスト | 不要 |
| `overview` | 日別PV/UU/セッション/直帰率/滞在時間 | 必須 |
| `traffic` | 流入元×メディア別セッション数（上位50） | 必須 |
| `pages` | ページ別PV/UU/滞在時間（上位100） | 必須 |
| `lp-performance` | LP配下ページメトリクス | 必須 |

認証: システム管理者セッション必須

## 環境変数

### ローカル開発（.env.local）
```
GA4_PROPERTY_ID=522574288
GOOGLE_APPLICATION_CREDENTIALS=credentials/ga-service-account.json
```

### Vercel本番/ステージング
```
GA4_PROPERTY_ID=522574288
GA_CREDENTIALS_JSON={"type":"service_account","project_id":"tastas-488506",...}
```
※ `GA_CREDENTIALS_JSON` にはJSON鍵ファイルの内容全体を1行で設定

## テスト方法

```bash
# CLIで接続テスト
npx tsx scripts/test-ga4-connection.ts

# APIエンドポイント（システム管理者ログイン後）
GET /api/ga-analytics?reportType=test
GET /api/ga-analytics?reportType=overview&startDate=2026-02-01&endDate=2026-02-25
```

## 今後の拡張（未着手）

- [ ] ダッシュボードUIへのGA4データ表示（新タブ or 既存タブ拡張）
- [ ] GA4データとカスタムトラッキング（Prisma DB）の照合比較
- [ ] デバイスカテゴリ別分析
- [ ] GA4コンバージョンパス分析
- [ ] Vercel環境変数への `GA_CREDENTIALS_JSON` 設定

## 既存のトラッキング構成（参考）

- Next.jsアプリ: `components/GoogleTagManager.tsx` で GTM を読み込み（ワーカー向けページのみ）
- LP（静的HTML）: 各 `public/lp/*/index.html` に GTM 直書き
- 独自トラッキング: `public/lp/tracking.js` + `app/api/lp-tracking/route.ts` + Prisma DB
- 独自LP帰属: `src/lib/lp-attribution.ts`（ハイブリッド3段階フォールバック）
