-- AlterTable: MinimumWage - Remove single unique on prefecture, add compound unique on (prefecture, effective_from)
-- This allows multiple records per prefecture (active + scheduled)

-- Drop existing unique constraint on prefecture
DROP INDEX IF EXISTS "minimum_wages_prefecture_key";

-- Add compound unique constraint
CREATE UNIQUE INDEX "prefecture_effective_from" ON "minimum_wages"("prefecture", "effective_from");

-- Add index on prefecture for efficient lookups
CREATE INDEX IF NOT EXISTS "minimum_wages_prefecture_idx" ON "minimum_wages"("prefecture");
