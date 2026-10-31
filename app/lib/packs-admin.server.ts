import { db } from "~/db.server";
import { allocatePrices } from "~/lib/sets";

export type PackCatalogProduct = {
  id: string;
  name: string;
  basePrice: number;
  status: string;
};

export type ResolvedPackProduct = {
  productId: string;
  name: string;
  basePrice: number;
  isPrimary: boolean;
  sortOrder: number;
};

const productSelect = {
  id: true,
  name: true,
  basePrice: true,
  status: true,
} as const;

type PackItemWithRelations = {
  isPrimary: boolean;
  sortOrder: number;
  product: {
    id: string;
    name: string;
    basePrice: { toString(): string } | number;
    status: string;
  } | null;
  bundle: {
    products: Array<{
      role: string;
      sortOrder: number;
      product: {
        id: string;
        name: string;
        basePrice: { toString(): string } | number;
        status: string;
      };
    }>;
  } | null;
};

/** Prefer product rows; if none, expand legacy scrub set top/pants. */
export function resolvePackProducts(items: PackItemWithRelations[]): ResolvedPackProduct[] {
  const fromProducts = items
    .filter((item) => item.product)
    .map((item, index) => ({
      productId: item.product!.id,
      name: item.product!.name,
      basePrice: Number(item.product!.basePrice),
      isPrimary: item.isPrimary,
      sortOrder: item.sortOrder ?? index,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (fromProducts.length > 0) {
    const hasPrimary = fromProducts.some((item) => item.isPrimary);
    if (!hasPrimary && fromProducts[0]) {
      fromProducts[0] = { ...fromProducts[0], isPrimary: true };
    }
    return fromProducts;
  }

  const setItem = items.find((item) => item.bundle);
  if (!setItem?.bundle) return [];

  const pieces = [...setItem.bundle.products].sort((a, b) => {
    if (a.role === "top" && b.role !== "top") return -1;
    if (b.role === "top" && a.role !== "top") return 1;
    return a.sortOrder - b.sortOrder;
  });

  return pieces.map((piece, index) => ({
    productId: piece.product.id,
    name: piece.product.name,
    basePrice: Number(piece.product.basePrice),
    isPrimary: index === 0,
    sortOrder: index,
  }));
}

export function packPricing(
  products: Array<{ basePrice: number }>,
  discountType: "fixed" | "percent",
  discountValue: number
) {
  const parts = products.map((product) => product.basePrice);
  const sum = parts.reduce((total, price) => total + price, 0);
  const priced = allocatePrices(parts, discountType, discountValue);
  return {
    sum,
    sellPrice: priced.total,
    shares: priced.shares,
  };
}

export async function listCatalogProductsForPacks(): Promise<PackCatalogProduct[]> {
  const products = await db.product.findMany({
    where: { status: { in: ["active", "draft"] } },
    orderBy: { name: "asc" },
    select: productSelect,
  });
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    basePrice: Number(product.basePrice),
    status: product.status,
  }));
}

export async function savePackProducts(
  packId: string,
  entries: Array<{ productId: string; isPrimary: boolean }>
) {
  const unique = new Map<string, { productId: string; isPrimary: boolean }>();
  for (const entry of entries) {
    if (!entry.productId) continue;
    unique.set(entry.productId, entry);
  }
  const list = [...unique.values()];
  if (list.length < 2) {
    throw new Error("A bundle needs at least two products.");
  }
  const primaryCount = list.filter((entry) => entry.isPrimary).length;
  if (primaryCount !== 1) {
    throw new Error("Mark exactly one product as primary.");
  }

  const ids = list.map((entry) => entry.productId);
  const found = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw new Error("One or more products could not be found.");
  }

  // Primary first, then remaining in submitted order
  const ordered = [
    ...list.filter((entry) => entry.isPrimary),
    ...list.filter((entry) => !entry.isPrimary),
  ];

  await db.packItem.deleteMany({ where: { packId } });
  await db.packItem.createMany({
    data: ordered.map((entry, index) => ({
      packId,
      productId: entry.productId,
      isPrimary: entry.isPrimary,
      sortOrder: index,
    })),
  });
}

export function parsePackProductEntries(formData: FormData) {
  const productIds = formData.getAll("productIds").map(String).filter(Boolean);
  const primaryId = String(formData.get("primaryProductId") ?? "").trim();
  const uniqueIds = [...new Set(productIds)];
  return uniqueIds.map((productId) => ({
    productId,
    isPrimary: productId === primaryId,
  }));
}
