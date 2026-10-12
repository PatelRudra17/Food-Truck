-- Remove the Cleaning feature.

-- DropForeignKey
ALTER TABLE "Cleaning" DROP CONSTRAINT "Cleaning_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "Cleaning" DROP CONSTRAINT "Cleaning_crateId_fkey";

-- DropForeignKey
ALTER TABLE "Cleaning" DROP CONSTRAINT "Cleaning_staffId_fkey";

-- DropTable
DROP TABLE "Cleaning";

-- DropEnum
DROP TYPE "CleaningStatus";
