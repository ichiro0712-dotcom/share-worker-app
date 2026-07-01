-- ============================================================
-- 【本番DB用】経験分野マスタ セットアップSQL
--   テーブル作成（DDL）＋ 初期データ投入 を1ファイルにまとめたもの
-- ============================================================
-- 用途:
--   本番DBに experience_field_categories / experience_fields を新規作成し、
--   初期マスタ（介護施設/病院/クリニック/その他）を正しいUTF-8で投入する。
--
-- 実行方法（重要・文字化け防止）:
--   このファイルを VS Code など UTF-8 対応エディタで開き、中身をコピーして
--   本番 Supabase の SQL Editor に貼り付けて実行する。
--   ※ ターミナル（PowerShell等）に表示されたテキストをコピペすると文字化けするため使わないこと。
--   ※ このファイルは UTF-8 (BOMなし) で保存されている。
--
-- 前提:
--   本番DBには両テーブルがまだ存在しないこと（新規セットアップ用）。
--   すでにテーブルが存在する場合は CREATE TABLE でエラー→トランザクションごとロールバックされる（安全）。
--
-- Prismaマイグレーション履歴との整合（任意）:
--   本番で今後 `npx prisma migrate deploy` を使う運用なら、このSQL適用後に一度だけ
--     npx prisma migrate resolve --applied 20260701000000_add_experience_field_master
--   を実行し、この変更を「適用済み」として記録しておくと履歴のズレを防げる。
--
-- 影響:
--   新規テーブルのため既存データへの影響なし。
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- ① テーブル作成（DDL）
--    prisma/migrations/20260701000000_add_experience_field_master/migration.sql と同一
-- ------------------------------------------------------------
CREATE TABLE "experience_field_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_type" TEXT,
    "updated_by_id" INTEGER,

    CONSTRAINT "experience_field_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experience_fields" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_type" TEXT,
    "updated_by_id" INTEGER,

    CONSTRAINT "experience_fields_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "experience_field_categories_sort_order_idx" ON "experience_field_categories"("sort_order");
CREATE INDEX "experience_fields_category_id_idx" ON "experience_fields"("category_id");
CREATE INDEX "experience_fields_sort_order_idx" ON "experience_fields"("sort_order");

ALTER TABLE "experience_fields"
  ADD CONSTRAINT "experience_fields_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "experience_field_categories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- ② 初期データ投入
-- ------------------------------------------------------------
-- カテゴリ
INSERT INTO "experience_field_categories" ("name", "sort_order", "is_published", "updated_at", "updated_by_type") VALUES
  ('介護施設',   0, true, now(), 'SYSTEM_ADMIN'),
  ('病院',       1, true, now(), 'SYSTEM_ADMIN'),
  ('クリニック', 2, true, now(), 'SYSTEM_ADMIN'),
  ('その他',     3, true, now(), 'SYSTEM_ADMIN');

-- 項目（カテゴリは name で参照）
INSERT INTO "experience_fields" ("category_id", "name", "sort_order", "is_published", "updated_at", "updated_by_type") VALUES
  -- 介護施設
  ((SELECT id FROM "experience_field_categories" WHERE name='介護施設'),   '特別養護老人ホーム',         0, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='介護施設'),   '介護老人保健施設',           1, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='介護施設'),   'グループホーム',             2, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='介護施設'),   'デイサービス',               3, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='介護施設'),   '訪問介護',                   4, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='介護施設'),   '有料老人ホーム',             5, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='介護施設'),   'サービス付き高齢者向け住宅', 6, true, now(), 'SYSTEM_ADMIN'),
  -- 病院
  ((SELECT id FROM "experience_field_categories" WHERE name='病院'),       '病院（急性期）',             0, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='病院'),       '病院（回復期）',             1, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='病院'),       '病院（地域包括ケア）',       2, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='病院'),       '病院（療養）',               3, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='病院'),       '病院（精神）',               4, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='病院'),       '病院（外来）',               5, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='病院'),       '病院（ICU・HCU）',           6, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='病院'),       '病院（オペ室）',             7, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='病院'),       '病院（その他）',             8, true, now(), 'SYSTEM_ADMIN'),
  -- クリニック
  ((SELECT id FROM "experience_field_categories" WHERE name='クリニック'), 'クリニック（無床）',         0, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='クリニック'), 'クリニック（有床）',         1, true, now(), 'SYSTEM_ADMIN'),
  -- その他
  ((SELECT id FROM "experience_field_categories" WHERE name='その他'),     '施設内健診',                 0, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='その他'),     '保育園',                     1, true, now(), 'SYSTEM_ADMIN'),
  ((SELECT id FROM "experience_field_categories" WHERE name='その他'),     'その他',                     2, true, now(), 'SYSTEM_ADMIN');

COMMIT;

-- ============================================================
-- 確認用（任意・上記COMMIT後に別途実行）
--   期待値: 介護施設=7 / 病院=9 / クリニック=2 / その他=3、名前が正しい日本語であること
-- ============================================================
-- SELECT c.sort_order AS cat_order, c.name AS category, count(f.id) AS field_count
-- FROM experience_field_categories c
-- LEFT JOIN experience_fields f ON f.category_id = c.id
-- GROUP BY c.id ORDER BY c.sort_order;
