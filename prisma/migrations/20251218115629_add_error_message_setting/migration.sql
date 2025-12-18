-- CreateTable
CREATE TABLE "error_message_settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "error_message_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "error_message_settings_key_key" ON "error_message_settings"("key");

-- CreateIndex
CREATE INDEX "applications_user_id_status_idx" ON "applications"("user_id", "status");

-- CreateIndex
CREATE INDEX "applications_status_created_at_idx" ON "applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "bookmarks_user_id_type_idx" ON "bookmarks"("user_id", "type");

-- CreateIndex
CREATE INDEX "bookmarks_target_job_id_idx" ON "bookmarks"("target_job_id");

-- CreateIndex
CREATE INDEX "facilities_facility_type_idx" ON "facilities"("facility_type");

-- CreateIndex
CREATE INDEX "facilities_prefecture_city_idx" ON "facilities"("prefecture", "city");

-- CreateIndex
CREATE INDEX "jobs_status_facility_id_idx" ON "jobs"("status", "facility_id");

-- CreateIndex
CREATE INDEX "jobs_created_at_idx" ON "jobs"("created_at");

-- CreateIndex
CREATE INDEX "jobs_status_created_at_idx" ON "jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "messages_application_id_created_at_idx" ON "messages"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_from_user_id_created_at_idx" ON "messages"("from_user_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_to_user_id_read_at_idx" ON "messages"("to_user_id", "read_at");
