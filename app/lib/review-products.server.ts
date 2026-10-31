import type { PrismaClient } from "@prisma/client";

/**
 * Product IDs that should share storefront reviews: the product itself plus
 * any other pieces that appear with it in the same set (Bundle).
 */
export async function getSharedReviewProductIds(
  db: PrismaClient,
  productId: string
): Promise<string[]> {
  const memberships = await db.bundleProduct.findMany({
    where: { productId },
    select: { bundleId: true },
  });

  if (memberships.length === 0) return [productId];

  const mates = await db.bundleProduct.findMany({
    where: { bundleId: { in: memberships.map((row) => row.bundleId) } },
    select: { productId: true },
  });

  return [...new Set([productId, ...mates.map((row) => row.productId)])];
}

/** Sets that include this product — for admin labels. */
export async function getSetsForProduct(
  db: PrismaClient,
  productId: string
): Promise<Array<{ name: string; slug: string }>> {
  const links = await db.bundleProduct.findMany({
    where: { productId },
    select: {
      bundle: { select: { name: true, slug: true } },
    },
  });

  const seen = new Set<string>();
  const sets: Array<{ name: string; slug: string }> = [];
  for (const link of links) {
    if (seen.has(link.bundle.slug)) continue;
    seen.add(link.bundle.slug);
    sets.push(link.bundle);
  }
  return sets;
}
