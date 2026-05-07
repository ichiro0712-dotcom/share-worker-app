-- Change Job.template_id FK from ON DELETE SET NULL to ON DELETE RESTRICT.
-- Purpose: enforce "cannot delete a JobTemplate that is in use by any Job" at the DB level,
-- preventing the race window between application-level count check and DELETE.

ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_template_id_fkey";

ALTER TABLE "jobs" ADD CONSTRAINT "jobs_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "job_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
