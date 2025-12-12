-- CreateTable
CREATE TABLE "job_description_formats" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_description_formats_pkey" PRIMARY KEY ("id")
);
