-- CreateTable
CREATE TABLE "notification_settings" (
    "id" SERIAL NOT NULL,
    "notification_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_type" TEXT NOT NULL,
    "chat_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "chat_message" TEXT,
    "email_subject" TEXT,
    "email_body" TEXT,
    "push_title" TEXT,
    "push_body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" SERIAL NOT NULL,
    "notification_key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "recipient_name" TEXT,
    "recipient_email" TEXT,
    "from_address" TEXT,
    "to_addresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT,
    "body" TEXT,
    "chat_application_id" INTEGER,
    "chat_message" TEXT,
    "push_title" TEXT,
    "push_body" TEXT,
    "push_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_notification_key_key" ON "notification_settings"("notification_key");

-- CreateIndex
CREATE INDEX "notification_logs_target_type_created_at_idx" ON "notification_logs"("target_type", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_notification_key_idx" ON "notification_logs"("notification_key");
