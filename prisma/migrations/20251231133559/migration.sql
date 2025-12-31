-- AlterTable
ALTER TABLE "services" ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[];
