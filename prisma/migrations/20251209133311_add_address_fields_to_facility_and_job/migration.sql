/*
  Warnings:

  - The values [APPLICATION_RECEIVED,MATCHING_SUCCESS,MESSAGE_RECEIVED,REVIEW_RECEIVED,JOB_REMINDER] on the enum `notification_type` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `job_id` on the `applications` table. All the data in the column will be lost.
  - You are about to drop the column `allow_bicycle` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `allow_bike` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `allow_public_transit` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `applied_count` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `beginner_ok` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `deadline` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `facility_within_5years` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `has_driver` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `has_parking` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `no_bathing_assist` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `work_date` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `facility_id` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `read_at` on the `notifications` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[work_date_id,user_id]` on the table `applications` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[job_id,user_id,reviewer_type]` on the table `reviews` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `work_date_id` to the `applications` table without a default value. This is not possible if the table is not empty.
  - Made the column `user_id` on table `notifications` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "cancelled_by" AS ENUM ('WORKER', 'FACILITY');

-- AlterEnum
BEGIN;
CREATE TYPE "notification_type_new" AS ENUM ('APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'NEW_MESSAGE', 'REVIEW_REQUEST', 'SYSTEM', 'APPLICATION_CANCELLED');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "notification_type_new" USING ("type"::text::"notification_type_new");
ALTER TYPE "notification_type" RENAME TO "notification_type_old";
ALTER TYPE "notification_type_new" RENAME TO "notification_type";
DROP TYPE "notification_type_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_job_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_facility_id_fkey";

-- DropIndex
DROP INDEX "applications_job_id_user_id_key";

-- AlterTable
ALTER TABLE "applications" DROP COLUMN "job_id",
ADD COLUMN     "cancel_notified_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by" "cancelled_by",
ADD COLUMN     "work_date_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "facilities" ADD COLUMN     "access_description" TEXT,
ADD COLUMN     "address_detail" TEXT,
ADD COLUMN     "address_line" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contact_person_first_name" TEXT,
ADD COLUMN     "contact_person_last_name" TEXT,
ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "dresscode_images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dresscode_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "email" TEXT,
ADD COLUMN     "emergency_contact" TEXT,
ADD COLUMN     "manager_first_name" TEXT,
ADD COLUMN     "manager_greeting" TEXT,
ADD COLUMN     "manager_last_name" TEXT,
ADD COLUMN     "manager_photo" TEXT,
ADD COLUMN     "map_image" TEXT,
ADD COLUMN     "parking" TEXT,
ADD COLUMN     "prefecture" TEXT,
ADD COLUMN     "representative_first_name" TEXT,
ADD COLUMN     "representative_last_name" TEXT,
ADD COLUMN     "smoking_measure" TEXT,
ADD COLUMN     "staff_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "staff_first_name" TEXT,
ADD COLUMN     "staff_last_name" TEXT,
ADD COLUMN     "staff_phone" TEXT,
ADD COLUMN     "staff_same_as_manager" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stations" JSONB,
ADD COLUMN     "transportation" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "transportation_note" TEXT,
ADD COLUMN     "work_in_smoking_area" TEXT,
ALTER COLUMN "address" DROP NOT NULL;

-- AlterTable
ALTER TABLE "facility_admins" ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "job_templates" ADD COLUMN     "attachments" TEXT[],
ADD COLUMN     "dismissal_reasons" TEXT,
ADD COLUMN     "dresscode_images" TEXT[];

-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "allow_bicycle",
DROP COLUMN "allow_bike",
DROP COLUMN "allow_public_transit",
DROP COLUMN "applied_count",
DROP COLUMN "beginner_ok",
DROP COLUMN "deadline",
DROP COLUMN "facility_within_5years",
DROP COLUMN "has_driver",
DROP COLUMN "has_parking",
DROP COLUMN "no_bathing_assist",
DROP COLUMN "work_date",
ADD COLUMN     "address_line" TEXT,
ADD COLUMN     "attachments" TEXT[],
ADD COLUMN     "blank_ok" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "deadline_days_before" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "dresscode_images" TEXT[],
ADD COLUMN     "meal_support" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthly_commitment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prefecture" TEXT,
ADD COLUMN     "requires_interview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weekly_frequency" INTEGER,
ALTER COLUMN "address" DROP NOT NULL;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "facility_id",
DROP COLUMN "read_at",
ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "rating_attendance" INTEGER,
ADD COLUMN     "rating_attitude" INTEGER,
ADD COLUMN     "rating_communication" INTEGER,
ADD COLUMN     "rating_execution" INTEGER,
ADD COLUMN     "rating_skill" INTEGER,
ADD COLUMN     "work_date_id" INTEGER,
ALTER COLUMN "application_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_name" TEXT,
ADD COLUMN     "account_number" TEXT,
ADD COLUMN     "address_line" TEXT,
ADD COLUMN     "bank_book_image" TEXT,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "branch_name" TEXT,
ADD COLUMN     "building" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "current_work_style" TEXT,
ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "desired_end_time" TEXT,
ADD COLUMN     "desired_start_time" TEXT,
ADD COLUMN     "desired_work_days" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "desired_work_days_week" TEXT,
ADD COLUMN     "desired_work_period" TEXT,
ADD COLUMN     "desired_work_style" TEXT,
ADD COLUMN     "emergency_address" TEXT,
ADD COLUMN     "emergency_name" TEXT,
ADD COLUMN     "emergency_phone" TEXT,
ADD COLUMN     "emergency_relation" TEXT,
ADD COLUMN     "experience_fields" JSONB,
ADD COLUMN     "first_name_kana" TEXT,
ADD COLUMN     "id_document" TEXT,
ADD COLUMN     "is_suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "job_change_desire" TEXT,
ADD COLUMN     "last_name_kana" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "pension_number" TEXT,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "prefecture" TEXT,
ADD COLUMN     "qualification_certificates" JSONB,
ADD COLUMN     "self_pr" TEXT,
ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "work_histories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "job_work_dates" (
    "id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "work_date" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "recruitment_count" INTEGER NOT NULL,
    "applied_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "matched_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_work_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_documents" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "document_data" JSONB NOT NULL,
    "pdf_generated" BOOLEAN NOT NULL DEFAULT false,
    "pdf_path" TEXT,
    "sent_to_chat" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_document_download_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "facility_admin_id" INTEGER NOT NULL,
    "worker_id" INTEGER NOT NULL,
    "facility_id" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "include_qualifications" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "downloaded" BOOLEAN NOT NULL DEFAULT false,
    "downloaded_at" TIMESTAMP(3),
    "zip_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_document_download_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_templates" (
    "id" SERIAL NOT NULL,
    "facility_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_admins" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_regions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "prefectures" TEXT[],
    "cities" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily_cache" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "metric_type" TEXT NOT NULL,
    "filter_key" TEXT NOT NULL DEFAULT 'all',
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_daily_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_tracking" (
    "id" SERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_type" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "last_step" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_work_dates_job_id_work_date_key" ON "job_work_dates"("job_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "labor_documents_application_id_key" ON "labor_documents"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "labor_document_download_tokens_token_key" ON "labor_document_download_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "system_admins_email_key" ON "system_admins"("email");

-- CreateIndex
CREATE INDEX "analytics_daily_cache_date_metric_type_idx" ON "analytics_daily_cache"("date", "metric_type");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_cache_date_metric_type_filter_key_key" ON "analytics_daily_cache"("date", "metric_type", "filter_key");

-- CreateIndex
CREATE UNIQUE INDEX "registration_tracking_session_id_key" ON "registration_tracking"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_work_date_id_user_id_key" ON "applications"("work_date_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_job_id_user_id_reviewer_type_key" ON "reviews"("job_id", "user_id", "reviewer_type");

-- AddForeignKey
ALTER TABLE "job_work_dates" ADD CONSTRAINT "job_work_dates_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_work_date_id_fkey" FOREIGN KEY ("work_date_id") REFERENCES "job_work_dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_documents" ADD CONSTRAINT "labor_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_work_date_id_fkey" FOREIGN KEY ("work_date_id") REFERENCES "job_work_dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_templates" ADD CONSTRAINT "review_templates_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
