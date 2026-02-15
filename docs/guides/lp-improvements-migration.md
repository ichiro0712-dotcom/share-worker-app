# LP管理改善 - 本番DB移行手順書

**対象PR**: feature/lp-improvements → develop
**作成日**: 2026-02-11

---

## 1. 概要

このPRでは以下のDB変更が含まれます：

| 変更内容 | テーブル | 操作 |
|---------|---------|------|
| `cta_url` フィールド追加 | `landing_pages` | ALTER TABLE |
| `is_hidden` フィールド追加 | `landing_pages` | ALTER TABLE |
| `sort_order` フィールド追加 | `landing_pages` | ALTER TABLE |
| `recommended_jobs` テーブル新規 | - | CREATE TABLE |
| `public_job_page_views` テーブル新規 | - | CREATE TABLE |

---

## 2. 作業手順

### Step 1: 本番DB接続情報を取得

```bash
# Vercelから本番環境変数を取得
vercel env pull --environment=production
# → .env.production.local に保存される
```

### Step 2: Prisma DB Push（スキーマ反映）

```bash
# 本番DBに対してスキーマを適用
# ※ .env.production.local の DATABASE_URL を使用
DATABASE_URL="本番のDATABASE_URL" npx prisma db push
```

または、以下のSQLを直接実行：

```sql
-- ========================================
-- Step 2-A: landing_pages テーブルへのフィールド追加
-- ========================================

-- cta_url: CTAリンク先URL
ALTER TABLE "landing_pages" ADD COLUMN IF NOT EXISTS "cta_url" TEXT;

-- is_hidden: 管理画面での非表示フラグ
ALTER TABLE "landing_pages" ADD COLUMN IF NOT EXISTS "is_hidden" BOOLEAN NOT NULL DEFAULT false;

-- sort_order: D&D並び替え用の表示順序
ALTER TABLE "landing_pages" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- インデックス追加
CREATE INDEX IF NOT EXISTS "landing_pages_is_hidden_idx" ON "landing_pages"("is_hidden");
CREATE INDEX IF NOT EXISTS "landing_pages_sort_order_idx" ON "landing_pages"("sort_order");

-- ========================================
-- Step 2-B: recommended_jobs テーブル新規作成
-- ========================================
CREATE TABLE IF NOT EXISTS "recommended_jobs" (
    "id" SERIAL PRIMARY KEY,
    "job_id" INTEGER NOT NULL UNIQUE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recommended_jobs_job_id_fkey"
        FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "recommended_jobs_sort_order_idx" ON "recommended_jobs"("sort_order");

-- ========================================
-- Step 2-C: public_job_page_views テーブル新規作成
-- ========================================
CREATE TABLE IF NOT EXISTS "public_job_page_views" (
    "id" SERIAL PRIMARY KEY,
    "lp_id" TEXT NOT NULL DEFAULT '0',
    "campaign_code" TEXT,
    "session_id" TEXT NOT NULL,
    "job_id" INTEGER NOT NULL,
    "user_agent" TEXT,
    "referrer" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "public_job_page_views_lp_id_campaign_code_idx"
    ON "public_job_page_views"("lp_id", "campaign_code");
CREATE INDEX IF NOT EXISTS "public_job_page_views_job_id_idx"
    ON "public_job_page_views"("job_id");
CREATE INDEX IF NOT EXISTS "public_job_page_views_session_id_idx"
    ON "public_job_page_views"("session_id");
CREATE INDEX IF NOT EXISTS "public_job_page_views_created_at_idx"
    ON "public_job_page_views"("created_at");
```

### Step 3: 既存LPデータの移行（cta_url・sort_order の初期化）

本番DBの既存LPレコードに `cta_url` と `sort_order` を設定します。

```sql
-- ========================================
-- 既存LPのcta_urlを設定
-- ※ 本番DBの既存LPにCTA URLがまだ設定されていない場合に実行
-- ========================================

-- LP1（Google広告 → LINE / lp=4Ghdqp）
UPDATE "landing_pages"
SET "cta_url" = 'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=4Ghdqp&liff_id=2009053059-UzfNXDJd'
WHERE "lp_number" = 1 AND "cta_url" IS NULL;

-- LP2（Meta広告 → LINE / lp=GQbsFI）
UPDATE "landing_pages"
SET "cta_url" = 'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=GQbsFI&liff_id=2009053059-UzfNXDJd'
WHERE "lp_number" = 2 AND "cta_url" IS NULL;

-- LP3（一般 Google広告 → LINE）
UPDATE "landing_pages"
SET "cta_url" = 'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=4Ghdqp&liff_id=2009053059-UzfNXDJd'
WHERE "lp_number" = 3 AND "cta_url" IS NULL;

-- LP4（一般 Meta広告 → LINE）
UPDATE "landing_pages"
SET "cta_url" = 'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=GQbsFI&liff_id=2009053059-UzfNXDJd'
WHERE "lp_number" = 4 AND "cta_url" IS NULL;

-- LP5（高単価訴求おすすめ求人 Google → LINE）
UPDATE "landing_pages"
SET "cta_url" = 'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=4Ghdqp&liff_id=2009053059-UzfNXDJd'
WHERE "lp_number" = 5 AND "cta_url" IS NULL;

-- LP6（高単価訴求おすすめ求人 Meta → LINE）
UPDATE "landing_pages"
SET "cta_url" = 'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=GQbsFI&liff_id=2009053059-UzfNXDJd'
WHERE "lp_number" = 6 AND "cta_url" IS NULL;

-- LP7（直接登録 → タスタスサイト）
UPDATE "landing_pages"
SET "cta_url" = 'https://tastas.work/'
WHERE "lp_number" = 7 AND "cta_url" IS NULL;

-- ========================================
-- sort_order を lp_number 順に初期化
-- ========================================
UPDATE "landing_pages" SET "sort_order" = "lp_number" - 1
WHERE "sort_order" = 0;

-- ========================================
-- 確認クエリ
-- ========================================
SELECT "lp_number", "name", "cta_url", "is_published", "is_hidden", "sort_order",
       "delivery_lp_number", "delivery_utm_source"
FROM "landing_pages"
ORDER BY "sort_order" ASC;

-- 期待される配信URL一覧:
-- LP1: /api/lp/1?utm_source=google   (delivery_lp_number=1, delivery_utm_source='google')
-- LP2: /api/lp/1?utm_source=meta     (delivery_lp_number=1, delivery_utm_source='meta')
-- LP3: /api/lp/2?utm_source=google   (delivery_lp_number=2, delivery_utm_source='google')
-- LP4: /api/lp/2?utm_source=meta     (delivery_lp_number=2, delivery_utm_source='meta')
-- LP5: /api/lp/5                     (delivery_lp_number=5, delivery_utm_source=NULL)
-- LP6: /api/lp/6                     (delivery_lp_number=NULL, delivery_utm_source=NULL)
-- LP7: /api/lp/7                     (delivery_lp_number=NULL, delivery_utm_source=NULL)
```

### Step 4: ローカルで追加したLP（LP5, LP6, LP7）の本番登録

本番DBにLP5, LP6, LP7がまだ存在しない場合、以下のSQLでレコードを追加します。

```sql
-- ========================================
-- LP5: 高単価訴求_おすすめ求人 (Google)
-- ※ 既に存在する場合はスキップされます
-- ========================================
INSERT INTO "landing_pages" (
    "lp_number", "name", "storage_path", "is_published",
    "delivery_lp_number", "delivery_utm_source",
    "cta_url", "has_gtm", "has_tracking", "has_line_tag",
    "is_hidden", "sort_order",
    "created_at", "updated_at"
) VALUES (
    5, '高単価訴求_おすすめ求人 (google)', '5/', true,
    5, NULL,
    'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=4Ghdqp&liff_id=2009053059-UzfNXDJd',
    true, true, true,
    false, 4,
    NOW(), NOW()
) ON CONFLICT ("lp_number") DO NOTHING;

-- ========================================
-- LP6: 高単価訴求_おすすめ求人 (Meta)
-- ========================================
INSERT INTO "landing_pages" (
    "lp_number", "name", "storage_path", "is_published",
    "delivery_lp_number", "delivery_utm_source",
    "cta_url", "has_gtm", "has_tracking", "has_line_tag",
    "is_hidden", "sort_order",
    "created_at", "updated_at"
) VALUES (
    6, '高単価訴求_おすすめ求人 (meta)', '6/', true,
    NULL, NULL,
    'https://liff.line.me/2009053059-UzfNXDJd/landing?follow=%40894ipobi&lp=GQbsFI&liff_id=2009053059-UzfNXDJd',
    true, true, true,
    false, 5,
    NOW(), NOW()
) ON CONFLICT ("lp_number") DO NOTHING;

-- ========================================
-- LP7: 高単価訴求_直接登録 (Google広告)
-- ========================================
INSERT INTO "landing_pages" (
    "lp_number", "name", "storage_path", "is_published",
    "delivery_lp_number", "delivery_utm_source",
    "cta_url", "has_gtm", "has_tracking", "has_line_tag",
    "is_hidden", "sort_order",
    "created_at", "updated_at"
) VALUES (
    7, '高単価訴求 _直接登録(Google広告)', '7/', true,
    NULL, NULL,
    'https://tastas.work/',
    true, true, true,
    false, 6,
    NOW(), NOW()
) ON CONFLICT ("lp_number") DO NOTHING;
```

**重要**: LP5, LP6, LP7のHTMLファイルも本番のSupabase Storage（`lp-assets` バケット）にアップロードする必要があります。LP管理画面からアップロードするか、以下のフォルダ構成でStorageに直接アップロードしてください：
- `lp-assets/5/index.html` + 画像等
- `lp-assets/6/index.html` + 画像等
- `lp-assets/7/index.html` + 画像等

### Step 5: Storage上のtracking.jsを最新版に更新

本番のSupabase Storage上のtracking.jsを最新版に更新します。
ローカルの `public/lp/tracking.js` を以下のパスにアップロードしてください：

- `lp-assets/1/tracking.js`
- `lp-assets/2/tracking.js`
- `lp-assets/3/tracking.js`
- `lp-assets/4/tracking.js`
- `lp-assets/5/tracking.js`（新規LP）
- `lp-assets/6/tracking.js`（新規LP）
- `lp-assets/7/tracking.js`（新規LP）

**理由**: 旧バージョンのtracking.jsには `initLineButtons()` 関数があり、CTA URLをハードコードされたLINE URLで上書きする問題がありました。最新版ではこの関数は削除されています。

### Step 6: デプロイ

```bash
# develop にマージ後、ステージングで確認
# → https://stg-share-worker.vercel.app/

# 確認OK後、develop → main にPRを作成してマージ
# → https://tastas.work/ に本番反映
```

---

## 3. 確認チェックリスト

### DB変更後
- [ ] `SELECT * FROM landing_pages ORDER BY sort_order;` で全LPが正しく表示される
- [ ] LP1-4の `cta_url` がLINE系URLになっている
- [ ] LP7の `cta_url` が `https://tastas.work/` になっている
- [ ] `recommended_jobs` テーブルが作成されている
- [ ] `public_job_page_views` テーブルが作成されている

### デプロイ後
- [ ] LP7（`/api/lp/7`）のCTAがtastas.workに遷移する（LINEに飛ばない）
- [ ] LP1-4のCTAが従来通りLINE友だち追加に遷移する
- [ ] LP管理画面（`/system-admin/lp`）が正常に表示される
- [ ] LP管理画面で非表示/再表示が動作する
- [ ] LP管理画面でLPコピーが動作する
- [ ] LP管理画面でD&D並び替えが動作する

---

## 4. ロールバック手順

問題が発生した場合：

```sql
-- cta_urlフィールドを削除（元の状態に戻す）
ALTER TABLE "landing_pages" DROP COLUMN IF EXISTS "cta_url";
ALTER TABLE "landing_pages" DROP COLUMN IF EXISTS "is_hidden";
ALTER TABLE "landing_pages" DROP COLUMN IF EXISTS "sort_order";

-- 新規テーブルを削除
DROP TABLE IF EXISTS "recommended_jobs";
DROP TABLE IF EXISTS "public_job_page_views";

-- 新規LPレコードを削除（必要な場合のみ）
DELETE FROM "landing_pages" WHERE "lp_number" IN (5, 6, 7);
```

デプロイのロールバックはVercelダッシュボードから前のデプロイメントに戻してください。
