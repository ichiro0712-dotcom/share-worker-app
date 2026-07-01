-- CreateTable
CREATE TABLE "experience_field_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_type" TEXT,
    "updated_by_id" INTEGER,

    CONSTRAINT "experience_field_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_fields" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_type" TEXT,
    "updated_by_id" INTEGER,

    CONSTRAINT "experience_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "experience_field_categories_sort_order_idx" ON "experience_field_categories"("sort_order");

-- CreateIndex
CREATE INDEX "experience_fields_category_id_idx" ON "experience_fields"("category_id");

-- CreateIndex
CREATE INDEX "experience_fields_sort_order_idx" ON "experience_fields"("sort_order");

-- AddForeignKey
ALTER TABLE "experience_fields" ADD CONSTRAINT "experience_fields_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "experience_field_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
