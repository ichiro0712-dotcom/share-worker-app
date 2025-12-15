/*
  Warnings:

  - You are about to drop the column `manager_greeting` on the `facilities` table. All the data in the column will be lost.
  - You are about to drop the column `manager_photo` on the `facilities` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "facility_viewed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "facilities" DROP COLUMN "manager_greeting",
DROP COLUMN "manager_photo",
ADD COLUMN     "manager_email" TEXT,
ADD COLUMN     "manager_phone" TEXT,
ADD COLUMN     "staff_email" TEXT,
ADD COLUMN     "staff_greeting" TEXT,
ADD COLUMN     "staff_photo" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "notification_settings" ADD COLUMN     "dashboard_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "system_notifications" (
    "id" SERIAL NOT NULL,
    "notification_key" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "application_id" INTEGER,
    "job_id" INTEGER,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nearby_notification_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "notification_key" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nearby_notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_notifications_target_type_recipient_id_idx" ON "system_notifications"("target_type", "recipient_id");

-- CreateIndex
CREATE INDEX "system_notifications_notification_key_idx" ON "system_notifications"("notification_key");

-- CreateIndex
CREATE INDEX "system_notifications_created_at_idx" ON "system_notifications"("created_at");

-- CreateIndex
CREATE INDEX "nearby_notification_logs_user_id_notification_key_sent_at_idx" ON "nearby_notification_logs"("user_id", "notification_key", "sent_at");

-- AddForeignKey
ALTER TABLE "system_notifications" ADD CONSTRAINT "system_notifications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_notifications" ADD CONSTRAINT "system_notifications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nearby_notification_logs" ADD CONSTRAINT "nearby_notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
