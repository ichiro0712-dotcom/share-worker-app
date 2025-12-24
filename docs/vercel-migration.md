# Netlify → Vercel 移行計画

## 概要

share-worker-app（+TASTAS）をNetlifyからVercelへ移行します。

| 項目 | 内容 |
|------|------|
| **現在のホスティング** | Netlify (`s-work.netlify.app`) |
| **移行先** | Vercel (`share-worker-app.vercel.app`) |
| **新Supabase** | `qcovuuqxyihbpjlgccxz` |
| **Vercelプロジェクト** | `share-worker-app` (career-project チーム) |

---

## 移行理由

1. **Image Optimization**: Netlifyでは無効化が必要だったが、Vercelでは標準対応
2. **Next.js公式サポート**: Vercelは Next.js の開発元であり、最新機能への対応が早い
3. **Cron Jobs**: Vercel Cron が標準で利用可能
4. **パフォーマンス**: Edge Functions、ISR最適化

---

## 変更対象ファイル

### 新規作成

#### 1. `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/job-batch",
      "schedule": "0 15 * * *"
    },
    {
      "path": "/api/cron/update-statuses",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

| Cron Job | スケジュール | 説明 |
|----------|-------------|------|
| `job-batch` | 毎日 JST 0:00 (UTC 15:00) | 限定求人→通常求人の自動切り替え、期限切れオファー削除 |
| `update-statuses` | 30分ごと | SCHEDULED→WORKING→COMPLETED_RATED ステータス更新 |

#### 2. `.nvmrc`
```
18
```

---

### 修正

#### 1. `next.config.mjs`

```diff
 const nextConfig = {
   images: {
-    // Netlifyでは標準のImage Optimizationがサポートされないため無効化
-    unoptimized: true,
+    // Vercelでは画像最適化を有効化
+    unoptimized: false,
     remotePatterns: [
       // 既存の設定は変更なし
     ],
   },
 };
```

#### 2. `app/system-admin/dev-portal/debug-checklist/page.tsx`

ハードコードされた `s-work.netlify.app` URL を更新:
- `https://s-work.netlify.app/login` → Vercel URL に変更
- 他3箇所のURL

---

### 削除

- `netlify.toml` - Vercelでは不要

---

## 環境変数設定（Vercel Dashboard）

Vercel Dashboardで以下の環境変数を設定:

| 変数名 | 説明 |
|--------|------|
| `DATABASE_URL` | 新Supabase Pooler URL |
| `DIRECT_URL` | 新Supabase Direct URL |
| `NEXTAUTH_SECRET` | 認証用シークレット |
| `NEXTAUTH_URL` | Vercel本番URL |
| `CRON_SECRET` | Cron認証用シークレット（32文字以上） |
| `NEXT_PUBLIC_APP_URL` | Vercel本番URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase匿名キー |
| `SUPABASE_SERVICE_KEY` | Supabaseサービスキー |
| `AWS_ACCESS_KEY_ID` | S3用 |
| `AWS_SECRET_ACCESS_KEY` | S3用 |
| `AWS_S3_BUCKET` | S3バケット名 |
| `AWS_REGION` | AWSリージョン |
| `GOOGLE_MAPS_API_KEY` | Google Maps API |
| `SYSTEM_ADMIN_SESSION_SECRET` | System Admin認証用 |

---

## 実行手順

### Phase 1: 計画共有（現在のPR）
- [x] 移行計画ドキュメント作成
- [ ] チームレビュー・承認
- [ ] 移行タイミングの合意

### Phase 2: コード変更（別PR）
1. [ ] `vercel.json` 作成
2. [ ] `.nvmrc` 作成
3. [ ] `next.config.mjs` 修正
4. [ ] `debug-checklist/page.tsx` 修正
5. [ ] `netlify.toml` 削除

### Phase 3: ローカルテスト
```bash
npm run build   # ビルド確認
npm run lint    # Lint確認
npm run dev     # 動作確認
```

### Phase 4: Vercelデプロイ
```bash
# プレビューデプロイ
vercel

# 環境変数設定後、本番デプロイ
vercel --prod
```

### Phase 5: 動作確認
- [ ] ビルド成功
- [ ] ページ表示確認（トップ、求人一覧、詳細）
- [ ] 認証フロー（ワーカー/施設/システム管理者）
- [ ] Cron Jobs動作確認
- [ ] 画像最適化動作確認

---

## 注意事項

### 並行運用期間
- **Netlify本番** (`s-work.netlify.app`) は移行完了まで稼働継続
- **Vercel** (`share-worker-app.vercel.app`) でテスト

### データベース
- 新Supabase (`qcovuuqxyihbpjlgccxz`) を使用
- 旧Supabase (`ziaunavcbawzorrwwnos`) には影響なし

### Vercel Hobbyプラン制限
| 項目 | 制限 |
|------|------|
| Cron Jobs | 2つまで（対応済み） |
| Image Optimization | 月1000枚まで |
| Serverless Function | 10秒タイムアウト |
| Bandwidth | 100GB/月 |

---

## ロールバック計画

問題発生時の対応:

1. Vercelデプロイを停止
2. Netlify (`s-work.netlify.app`) を継続使用
3. 原因調査・修正後に再デプロイ

---

## タイムライン（案）

| 日程 | 作業 |
|------|------|
| Week 1 | 計画共有・チーム合意 |
| Week 2 | コード変更PR・レビュー |
| Week 3 | Vercelプレビュー環境でテスト |
| Week 4 | 本番切り替え |

※ 旧DBでの作業状況に応じて調整

---

## 質問・懸念点

- [ ] 移行のタイミング（旧DBでの作業完了後？）
- [ ] ドメイン（Vercelドメインのまま or カスタムドメイン取得？）
- [ ] その他の懸念事項
