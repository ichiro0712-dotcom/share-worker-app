-- point_ledger_entries に rate_basis_points を追加する。
-- チャージ(ATTENDANCE_CONFIRMED)時の前払い率を保存し、
-- 勤怠修正後の差額調整(MANUAL_ADJUSTMENT)で原チャージと同じ率を使うため。
-- 参照: docs/hibarai/settlement-month-spec.md, docs/hibarai/wage-adjustment-spec.md

-- AlterTable: nullable で追加（加算的・既存行は影響なし）
ALTER TABLE "point_ledger_entries" ADD COLUMN "rate_basis_points" INTEGER;

-- ガード: 既存の ATTENDANCE_CONFIRMED に rate_basis_points が無い行があれば失敗させる。
-- 調整は原チャージの率を使うため、率不明の既存チャージがあると残高を誤って調整する。
-- 日払いは未公開のため通常0件。万一存在する場合は backfill 後に再実行すること。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM point_ledger_entries
    WHERE kind = 'ATTENDANCE_CONFIRMED' AND rate_basis_points IS NULL
  ) THEN
    RAISE EXCEPTION 'ATTENDANCE_CONFIRMED rows without rate_basis_points exist; backfill required before applying this migration';
  END IF;
END $$;
