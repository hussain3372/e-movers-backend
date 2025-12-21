/*
  Warnings:

  - You are about to drop the column `description` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `bookings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "description",
DROP COLUMN "title",
ADD COLUMN     "comments" TEXT,
ADD COLUMN     "dropOffLocation" TEXT,
ADD COLUMN     "isBusiness" BOOLEAN,
ADD COLUMN     "isCompany" BOOLEAN,
ADD COLUMN     "isHometown" BOOLEAN,
ADD COLUMN     "isStudent" BOOLEAN,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "pickupLocation" TEXT,
ADD COLUMN     "preferredDate" TIMESTAMP(3),
ADD COLUMN     "rentalPlan" TEXT,
ADD COLUMN     "serviceType" TEXT,
ADD COLUMN     "storageSize" TEXT,
ADD COLUMN     "storageType" TEXT,
ALTER COLUMN "logo" DROP NOT NULL;
