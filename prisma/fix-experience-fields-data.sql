-- ============================================================
-- 経験分野マスタ データ修正用SQL（文字化け復旧）
-- ============================================================
-- 用途:
--   SQLエディタへの貼り付け時に文字化けして保存された
--   experience_field_categories / experience_fields のデータを、
--   一旦全削除して正しいUTF-8で入れ直す。
--
-- 前提:
--   テーブル自体（①のDDL）は作成済みで正常。データ（②のINSERT）のみ壊れている。
--
-- 実行方法（重要）:
--   このファイルを VS Code など UTF-8 対応エディタで開き、
--   中身をコピーして Supabase の SQL Editor に貼り付けて実行する。
--   ※ ターミナル（PowerShell等）を経由してコピペすると文字化けするため使わないこと。
--   ※ ファイルは UTF-8 (BOMなし) で保存されている。
--
-- 影響:
--   ワーカーの登録データ（Profile.experience_fields）は施設名を「文字列」で別保持しており、
--   このテーブルへのFKは無いため、削除・再作成しても既存ワーカーの登録内容には影響しない。
-- ============================================================

BEGIN;

-- 1) 壊れた既存データを全削除（fields → categories の順）
DELETE FROM "experience_fields";
DELETE FROM "experience_field_categories";

-- 2) カテゴリを再投入
INSERT INTO "experience_field_categories" ("name", "sort_order", "is_published", "updated_at", "updated_by_type") VALUES
  ('介護施設',   0, true, now(), 'SYSTEM_ADMIN'),
  ('病院',       1, true, now(), 'SYSTEM_ADMIN'),
  ('クリニック', 2, true, now(), 'SYSTEM_ADMIN'),
  ('その他',     3, true, now(), 'SYSTEM_ADMIN');

-- 3) 項目を再投入（カテゴリは name で参照）
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
