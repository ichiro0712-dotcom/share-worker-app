# Vercel移行完了

> **注意**: このファイルは2024年12月時点のアーカイブです。最新情報は [deployment.md](../../guides/deployment.md) を参照してください。

## 移行ステータス: ✅ 完了（2024年12月）

share-worker-app（+TASTAS）はVercelへの移行が完了しました。

## 現在の本番環境（2026年1月更新）

| 項目 | 内容 |
|------|------|
| **ホスティング** | Vercel |
| **本番URL** | https://tastas.work |
| **GitHubリポジトリ** | ichiro0712-dotcom/share-worker-app |

## インフラ構成

| サービス | 用途 |
|---------|------|
| **Vercel** | Webホスティング・自動デプロイ |
| **Supabase** | DB（PostgreSQL）+ Storage（S3互換） |
| **Resend** | メール送信 |

### Supabaseプロジェクト

| プロジェクトID | 用途 |
|---------------|------|
| `ryvyuxomiqcgkspmpltk` | 本番 |
| `qcovuuqxyihbpjlgccxz` | ステージング |
| `ziaunavcbawzorrwwnos` | ステージングDB/Storage（旧・画像データ維持用） |

## 重要

- **Netlify**: 使用禁止（Vercelのみ使用）

## デプロイ方法

GitHubの`main`ブランチにプッシュすると、自動的にVercelにデプロイされます。

```bash
git push origin main
```
