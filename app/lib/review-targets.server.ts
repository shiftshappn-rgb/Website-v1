import type { PrismaClient } from "@prisma/client";
import { parseBundleProductName } from "~/lib/order-line-groups";

export type ReviewTarget = {
  label: string;
  href: string;
};

type OrderLineForReview = {
  productVariantId: string | null;
  productName: string;
  lineType?: string;
};

/**
 * Build unique “leave a review” links for purchased lines.
 * Prefers set pages when both pieces of a set appear in the order.
 */
export async function resolveReviewTargetsFromOrder(
  db: PrismaClient,
  items: OrderLineForReview[]
): Promise<ReviewTarget[]> {
  const productLines = items.filter(
    (item) => (item.lineType ?? "product") === "product" && item.productVariantId
  );
  if (productLines.length === 0) return [];

  const variantIds = [
    ...new Set(productLines.map((item) => item.productVariantId!).filter(Boolean)),
  ];

  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          bundleItems: {
            select: {
              role: true,
              bundle: { select: { slug: true, name: true } },
            },
          },
        },
      },
    },
  });

  const productByVariantId = new Map(
    variants.map((variant) => [variant.id, variant.product])
  );

  const purchasedProductIds = new Set(
    variants
      .filter((variant) => variant.product.status === "active")
      .map((variant) => variant.product.id)
  );

  const targets: ReviewTarget[] = [];
  const seen = new Set<string>();

  function push(href: string, label: string) {
    if (seen.has(href)) return;
    seen.add(href);
    targets.push({ href, label });
  }

  // Prefer set links when both top + pants of a set were purchased
  const setCandidates = new Map<
    string,
    { slug: string; name: string; roles: Set<string>; productIds: string[] }
  >();

  for (const variant of variants) {
    const product = variant.product;
    if (product.status !== "active") continue;
    for (const link of product.bundleItems) {
      const key = link.bundle.slug;
      const entry = setCandidates.get(key) ?? {
        slug: link.bundle.slug,
        name: link.bundle.name,
        roles: new Set<string>(),
        productIds: [],
      };
      entry.roles.add(link.role);
      if (!entry.productIds.includes(product.id)) entry.productIds.push(product.id);
      setCandidates.set(key, entry);
    }
  }

  for (const set of setCandidates.values()) {
    const bothPiecesBought =
      set.roles.has("top") &&
      set.roles.has("pants") &&
      set.productIds.every((id) => purchasedProductIds.has(id));
    if (!bothPiecesBought) continue;
    push(`/sets/${set.slug}#reviews`, `${set.name} set`);
    for (const id of set.productIds) purchasedProductIds.delete(id);
  }

  for (const line of productLines) {
    const product = productByVariantId.get(line.productVariantId!);
    if (!product || product.status !== "active") continue;
    if (!purchasedProductIds.has(product.id)) continue;

    const parsed = parseBundleProductName(line.productName);
    const label = parsed.bundleName
      ? `${parsed.bundleName} — ${product.name}`
      : product.name;
    push(`/products/${product.slug}#reviews`, label);
    purchasedProductIds.delete(product.id);
  }

  return targets;
}
