-- Add legacy_calculated_wage column to attendances table.
-- Purpose: preserve old-method salary value when recalculating with the new
-- 2-stage ceiling formula. Allows reconciliation against bank transfer history
-- and rollback if needed.
--
-- Nullable so existing rows are unaffected; populated by the
-- prisma/recalc-salary-with-new-method.ts script during the migration window.

ALTER TABLE "attendances" ADD COLUMN "legacy_calculated_wage" INTEGER;
