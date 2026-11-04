import type { PrismaClient } from "@prisma/client";

/**
 * Attach guest checkout orders (customerId null) to this account when the
 * order email matches. Case-insensitive — guest checkout may not lower-case email.
 */
export async function claimGuestOrdersByEmail(
  db: PrismaClient,
  customerId: string,
  email: string
): Promise<number> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !customerId) return 0;

  const result = await db.order.updateMany({
    where: {
      customerId: null,
      email: { equals: normalized, mode: "insensitive" },
    },
    data: { customerId },
  });

  return result.count;
}
