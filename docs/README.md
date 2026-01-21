# +TASTAS ドキュメント

> **更新日**: 2026-01-17

+TASTAS（看護師・介護士向け求人マッチングサービス）の技術ドキュメント集。

---

## ディレクトリ構成

```
docs/
├── README.md                  # このファイル
├── specifications/            # 仕様書
├── features/                  # 機能仕様書
├── guides/                    # 開発ガイド
├── manuals/                   # ユーザーマニュアル
├── test-reports/              # テストレポート
└── archive/                   # アーカイブ（過去の資料）
```

---

## 仕様書（specifications/）

プロジェクトの基本仕様を定義。

| ドキュメント | 説明 |
|--------------|------|
| [要件定義書](./specifications/requirements.md) | サービス要件・機能一覧 |
| [システム設計書](./specifications/system-design.md) | アーキテクチャ・DB設計 |
| [画面仕様書](./specifications/screen-specification.md) | 画面構成・URL一覧 |
| [スタイルガイド（管理者）](./specifications/style-guide/admin.md) | 施設管理画面のデザイン |
| [スタイルガイド（ワーカー）](./specifications/style-guide/worker.md) | ワーカー画面のデザイン |

---

## 機能仕様書（features/）

各機能の詳細仕様。

| ドキュメント | 説明 |
|--------------|------|
| [求人マッチング](./features/job-matching.md) | 求人検索・応募・マッチング || [メッセージ](./features/messaging.md) | チャット機能 |
| [通知](./features/notifications.md) | プッシュ通知・メール・チャット通知 |
| [レビュー](./features/reviews.md) | 相互評価機能 |
| [アナリティクス](./features/analytics.md) | 分析ダッシュボード |
| [System Admin](./features/system-admin.md) | システム管理者機能 |
| [オファー・限定求人](./features/offer-limited-job.md) | 特殊求人タイプ |
| [メール実装分析](./features/email-implementation-analysis.md) | メール送信の技術詳細 |

---

## 開発ガイド（guides/）

開発者向けのガイドライン。

| ドキュメント | 説明 |
|--------------|------|
| [開発環境セットアップ](./guides/development.md) | ローカル環境構築手順 |
| [デプロイ](./guides/deployment.md) | Vercelデプロイ手順 |
| [テスト](./guides/testing.md) | E2Eテストの実行方法 |

---

## ユーザーマニュアル（manuals/）

エンドユーザー向けの操作マニュアル。

| ドキュメント | 説明 |
|--------------|------|
| [ワーカー向けマニュアル](./manuals/worker-manual.md) | ワーカー（求職者）向け |
| [施設管理者向けマニュアル](./manuals/facility-manual.md) | 施設担当者向け |

---

## テストレポート（test-reports/）

テスト実行結果・カバレッジ情報。

| ドキュメント | 説明 |
|--------------|------|
| [E2Eテストカバレッジ](./test-reports/e2e-test-coverage.md) | テストカバレッジ状況 |

---

## アーカイブ（archive/）

過去の開発タスク指示書・デバッグ記録。現行仕様には含まれない。

- `archive/2024-12-tasks/` - 2024年12月の開発タスク
- `archive/2025-01-debug/` - 2025年1月のデバッグ記録

---

## クイックリンク

### 環境

| 環境 | URL | 用途 |
|------|-----|------|
| 本番 | https://tastas.work | 本番環境 |
| ステージング | https://stg-share-worker.vercel.app | 検証環境 |

### インフラ構成

| サービス | 用途 | 備考 |
|---------|------|------|
| **Vercel** | Webホスティング | 自動デプロイ |
| **Supabase** | DB/Storage | PostgreSQL + S3互換ストレージ |
| **Resend** | メール送信 | トランザクションメール |

### よく使うコマンド

```bash
npm run dev           # 開発サーバー起動
npm run build         # ビルド
npx prisma studio     # DB GUI
npx playwright test   # E2Eテスト
```

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-01-17 | 本番URL更新（tastas.work）、インフラ構成追記 |
| 2025-01-07 | ドキュメント構造を整理、マニュアル追加 |
| 2024-12-04 | 初版作成 |
