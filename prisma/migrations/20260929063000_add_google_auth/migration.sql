-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "googleId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "avatarUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_googleId_key" ON "Customer"("googleId");
