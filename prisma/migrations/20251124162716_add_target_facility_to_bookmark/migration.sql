-- AlterTable
ALTER TABLE "bookmarks" ADD COLUMN     "target_facility_id" INTEGER;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_target_facility_id_fkey" FOREIGN KEY ("target_facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
