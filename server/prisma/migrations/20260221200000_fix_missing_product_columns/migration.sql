-- AlterTable: Add season to Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "season" TEXT NOT NULL DEFAULT 'all';

-- AlterTable: Add missing thumbnail and original columns to ProductImage
ALTER TABLE "ProductImage" ADD COLUMN IF NOT EXISTS "thumbnail" TEXT;
ALTER TABLE "ProductImage" ADD COLUMN IF NOT EXISTS "original" TEXT;
