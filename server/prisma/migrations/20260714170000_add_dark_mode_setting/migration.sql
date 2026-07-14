-- AlterTable
ALTER TABLE "User" ADD COLUMN "darkModeSetting" TEXT DEFAULT 'system';
ALTER TABLE "User" ADD COLUMN "fontSize" TEXT DEFAULT 'normal';
ALTER TABLE "User" ADD COLUMN "highContrast" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "language" TEXT DEFAULT 'es';
ALTER TABLE "User" ADD COLUMN "dialect" TEXT DEFAULT 'none';
