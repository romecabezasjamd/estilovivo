-- AlterTable
ALTER TABLE "User" ADD COLUMN "isProfilePublic" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "styleColors" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "styleStyles" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "styleOccasions" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "styleFabrics" TEXT;
