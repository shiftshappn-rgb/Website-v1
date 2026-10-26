-- CreateEnum
CREATE TYPE "BundlePieceRole" AS ENUM ('top', 'pants');

-- AlterTable
ALTER TABLE "BundleProduct" ADD COLUMN "role" "BundlePieceRole" NOT NULL DEFAULT 'top';
