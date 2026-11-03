-- Rebuild OrderStatus: paid → received; add processing + refund_initiated
CREATE TYPE "OrderStatus_new" AS ENUM (
  'pending',
  'received',
  'processing',
  'fulfilled',
  'refund_initiated',
  'refunded',
  'cancelled'
);

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE "OrderStatus_new"
  USING (
    CASE "status"::text
      WHEN 'paid' THEN 'received'::"OrderStatus_new"
      ELSE "status"::text::"OrderStatus_new"
    END
  );

DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";

ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'pending'::"OrderStatus";

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryCodeIssuedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fulfilledAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundInitiatedAt" TIMESTAMP(3);
