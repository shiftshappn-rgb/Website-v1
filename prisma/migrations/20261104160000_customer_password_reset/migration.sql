ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP(3);
