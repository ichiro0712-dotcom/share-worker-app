-- 出金申請に振込先口座スナップショット(bank_snapshot)を追加する。
-- 申請確定時の口座情報(immutable)を保存し、GMO送金はこの値のみを使う。
-- PENDING中に口座が変更されても送金先がすり替わらないようにする(P0-3)。
-- 参照: docs/hibarai/bank-snapshot-spec.md

-- AlterTable: nullable で追加（加算的・既存行0件想定）
ALTER TABLE "withdrawal_requests" ADD COLUMN "bank_snapshot" JSONB;

-- ガード: snapshotを持てない既存出金があれば失敗させる（未公開のため通常0件）。
-- 1件でもある環境では、適用前に bank_account から bank_snapshot を backfill すること。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM withdrawal_requests WHERE bank_snapshot IS NULL) THEN
    RAISE EXCEPTION 'withdrawal_requests without bank_snapshot exist; backfill required before NOT NULL';
  END IF;
END $$;

-- NOT NULL 化（出金にsnapshot必須）
ALTER TABLE "withdrawal_requests" ALTER COLUMN "bank_snapshot" SET NOT NULL;
