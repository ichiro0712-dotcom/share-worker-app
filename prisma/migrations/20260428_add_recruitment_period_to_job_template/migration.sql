-- AlterTable: JobTemplate - Add recruitment period fields (start day/time, end day/time)
-- This fixes a bug where recruitment start/end date/time set in templates
-- were not reflected when creating jobs from templates.
--
-- Default values:
--   deadline_days_before  = -2 (= 勤務1日前)  クライアント承認済の既存テンプレ向けデフォルト
--   recruitment_start_day = 0  (= 公開時)
--   recruitment_start_time / recruitment_end_time = NULL (時刻指定なし)

ALTER TABLE "job_templates"
  ADD COLUMN "deadline_days_before"   INTEGER NOT NULL DEFAULT -2,
  ADD COLUMN "recruitment_start_day"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recruitment_start_time" TEXT,
  ADD COLUMN "recruitment_end_time"   TEXT;
