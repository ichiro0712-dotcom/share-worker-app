-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "allow_bicycle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allow_bike" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allow_car" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allow_public_transit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "beginner_ok" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "facility_within_5years" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hair_style_free" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_driver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_parking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inexperienced_ok" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nail_ok" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "no_bathing_assist" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "uniform_provided" BOOLEAN NOT NULL DEFAULT false;
