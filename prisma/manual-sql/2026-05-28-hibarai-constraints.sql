-- Prisma schema では表現できない日払い系制約。
-- Prisma migration 作成後、同一 migration.sql の末尾にこの内容を反映する。

CREATE UNIQUE INDEX IF NOT EXISTS point_ledger_entries_attendance_confirmed_once
  ON point_ledger_entries(attendance_id)
  WHERE kind = 'ATTENDANCE_CONFIRMED' AND attendance_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'emergency_stop_states_singleton_id'
  ) THEN
    ALTER TABLE emergency_stop_states
      ADD CONSTRAINT emergency_stop_states_singleton_id
      CHECK (id = 'global');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'advance_payment_policies_rate_basis_points_range'
  ) THEN
    ALTER TABLE advance_payment_policies
      ADD CONSTRAINT advance_payment_policies_rate_basis_points_range
      CHECK (rate_basis_points BETWEEN 0 AND 10000);
  END IF;
END $$;
