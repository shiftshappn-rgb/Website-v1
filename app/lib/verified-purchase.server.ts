import type { PrismaClient } from "@prisma/client";
import { PURCHASE_ACTIVE_STATUSES } from "~/lib/order-status";

/**
 * Verified purchase requires the order to be linked to this customer id.
 * Matching by email alone is unsafe without email verification (anyone can
 * register as the guest checkout email and claim the badge).
 */
export async function customerHasVerifiedPurchase(
  db: PrismaClient,
  customerId: string,
  productIds: string[]
): Promise<boolean> {
  if (productIds.length === 0) return false;

  const hit = await db.orderItem.findFirst({
    where: {
      productVariant: { productId: { in: productIds } },
      order: {
        status: { in: PURCHASE_ACTIVE_STATUSES },
        customerId,
      },
    },
    select: { id: true },
  });

  return Boolean(hit);
}
