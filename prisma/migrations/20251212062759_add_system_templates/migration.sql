/*
  Warnings:

  - You are about to drop the column `cities` on the `analytics_regions` table. All the data in the column will be lost.
  - You are about to drop the column `prefectures` on the `analytics_regions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "analytics_regions" DROP COLUMN "cities",
DROP COLUMN "prefectures",
ADD COLUMN     "prefecture_cities" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "filter_conditions" JSONB,
ADD COLUMN     "scheduled_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "facilities" ADD COLUMN     "is_pending" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "lat" SET DEFAULT 0,
ALTER COLUMN "lng" SET DEFAULT 0,
ALTER COLUMN "phone_number" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "faq_categories" (
    "id" SERIAL NOT NULL,
    "target_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_guides" (
    "id" SERIAL NOT NULL,
    "target_type" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploaded_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" SERIAL NOT NULL,
    "doc_type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_recipients" (
    "id" SERIAL NOT NULL,
    "announcement_id" INTEGER NOT NULL,
    "recipient_type" TEXT NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_document_templates" (
    "id" SERIAL NOT NULL,
    "template_content" TEXT NOT NULL,
    "accent_color" TEXT NOT NULL DEFAULT '#3B82F6',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_templates" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "facility_id" INTEGER,

    CONSTRAINT "system_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_documents_doc_type_target_type_is_current_idx" ON "legal_documents"("doc_type", "target_type", "is_current");

-- CreateIndex
CREATE INDEX "announcement_recipients_recipient_type_recipient_id_idx" ON "announcement_recipients"("recipient_type", "recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_recipients_announcement_id_recipient_type_reci_key" ON "announcement_recipients"("announcement_id", "recipient_type", "recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_templates_key_key" ON "system_templates"("key");

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "faq_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_recipients" ADD CONSTRAINT "announcement_recipients_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_templates" ADD CONSTRAINT "system_templates_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
