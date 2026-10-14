-- AlterTable
ALTER TABLE "Order" ADD COLUMN "confirmationSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");
