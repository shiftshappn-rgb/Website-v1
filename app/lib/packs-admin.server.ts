import { db } from "~/db.server";
import { allocatePrices } from "~/lib/sets";

export type PackCatalogProduct = {
  id: string;
  name: string;
  basePrice: number;
  status: string;
};

export type PackCatalogSet = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  topName: string;
  pantsName: string;
};

export type PackItemEntry =
  | { kind: "product"; productId: string; isPrimary: boolean }
  | { kind: "set"; bundleId: string; isPrimary: boolean };

export type ResolvedPackProduct = {
  productId: string;
  name: string;
  basePrice: number;
  isPrimary: boolean;
  sortOrder: number;
  setBundleId?: string;
  setName?: string;
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
    id?: string;
    name?: string;
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

/** Expand pack items to priced product rows (sets become top + pants). */
export function resolvePackProducts(items: PackItemWithRelations[]): ResolvedPackProduct[] {
  const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const resolved: ResolvedPackProduct[] = [];

  for (const item of ordered) {
    if (item.product) {
      resolved.push({
        productId: item.product.id,
        name: item.product.name,
        basePrice: Number(item.product.basePrice),
        isPrimary: item.isPrimary,
        sortOrder: item.sortOrder,
      });
      continue;
    }

    if (!item.bundle) continue;

    const pieces = [...item.bundle.products].sort((a, b) => {
      if (a.role === "top" && b.role !== "top") return -1;
      if (b.role === "top" && a.role !== "top") return 1;
      return a.sortOrder - b.sortOrder;
    });

    pieces.forEach((piece, index) => {
      resolved.push({
        productId: piece.product.id,
        name: piece.product.name,
        basePrice: Number(piece.product.basePrice),
        isPrimary: item.isPrimary && index === 0,
        sortOrder: item.sortOrder,
        setBundleId: item.bundle?.id,
        setName: item.bundle?.name,
      });
    });
  }

  if (resolved.length === 0) return [];

  const hasPrimary = resolved.some((item) => item.isPrimary);
  if (!hasPrimary && resolved[0]) {
    resolved[0] = { ...resolved[0], isPrimary: true };
  }

  return resolved;
}

/** Admin form line items: one row per pack unit (set or product). */
export function resolvePackItemEntries(items: PackItemWithRelations[]): PackItemEntry[] {
  const entries: PackItemEntry[] = [];
  for (const item of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (item.bundle?.id) {
      entries.push({
        kind: "set",
        bundleId: item.bundle.id,
        isPrimary: item.isPrimary,
      });
      continue;
    }
    if (item.product) {
      entries.push({
        kind: "product",
        productId: item.product.id,
        isPrimary: item.isPrimary,
      });
    }
  }
  return entries;
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

export async function listCatalogSetsForPacks(): Promise<PackCatalogSet[]> {
  const bundles = await db.bundle.findMany({
    orderBy: { name: "asc" },
    include: {
      products: {
        include: {
          product: { select: { name: true, basePrice: true, status: true } },
        },
      },
    },
  });

  return bundles.flatMap((bundle) => {
    const top = bundle.products.find((item) => item.role === "top")?.product;
    const pants = bundle.products.find((item) => item.role === "pants")?.product;
    if (!top || !pants) return [];
    if (top.status === "archived" || pants.status === "archived") return [];

    return [
      {
        id: bundle.id,
        name: bundle.name,
        slug: bundle.slug,
        basePrice: Number(top.basePrice) + Number(pants.basePrice),
        topName: top.name,
        pantsName: pants.name,
      },
    ];
  });
}

export async function savePackItems(packId: string, entries: PackItemEntry[]) {
  const unique = new Map<string, PackItemEntry>();
  for (const entry of entries) {
    if (entry.kind === "product") {
      if (!entry.productId) continue;
      unique.set(`product:${entry.productId}`, entry);
    } else {
      if (!entry.bundleId) continue;
      unique.set(`set:${entry.bundleId}`, entry);
    }
  }
  const list = [...unique.values()];
  if (list.length < 2) {
    throw new Error("A bundle needs at least two items (for example a scrub set plus an accessory).");
  }
  const primaryCount = list.filter((entry) => entry.isPrimary).length;
  if (primaryCount !== 1) {
    throw new Error("Mark exactly one item as primary.");
  }

  const productIds = list
    .filter((entry): entry is Extract<PackItemEntry, { kind: "product" }> => entry.kind === "product")
    .map((entry) => entry.productId);
  const bundleIds = list
    .filter((entry): entry is Extract<PackItemEntry, { kind: "set" }> => entry.kind === "set")
    .map((entry) => entry.bundleId);

  if (productIds.length > 0) {
    const found = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (found.length !== productIds.length) {
      throw new Error("One or more products could not be found.");
    }
  }
  if (bundleIds.length > 0) {
    const found = await db.bundle.findMany({
      where: { id: { in: bundleIds } },
      select: { id: true },
    });
    if (found.length !== bundleIds.length) {
      throw new Error("One or more scrub sets could not be found.");
    }
  }

  const ordered = [
    ...list.filter((entry) => entry.isPrimary),
    ...list.filter((entry) => !entry.isPrimary),
  ];

  await db.packItem.deleteMany({ where: { packId } });
  for (const [index, entry] of ordered.entries()) {
    await db.packItem.create({
      data: {
        packId,
        productId: entry.kind === "product" ? entry.productId : null,
        bundleId: entry.kind === "set" ? entry.bundleId : null,
        isPrimary: entry.isPrimary,
        sortOrder: index,
      },
    });
  }
}

/** @deprecated Prefer savePackItems — kept for call sites still using product-only entries. */
export async function savePackProducts(
  packId: string,
  entries: Array<{ productId: string; isPrimary: boolean }>
) {
  await savePackItems(
    packId,
    entries.map((entry) => ({
      kind: "product" as const,
      productId: entry.productId,
      isPrimary: entry.isPrimary,
    }))
  );
}

export function parsePackItemEntries(formData: FormData): PackItemEntry[] {
  const kinds = formData.getAll("itemKinds").map(String);
  const ids = formData.getAll("itemIds").map(String);
  const primaryKey = String(formData.get("primaryItemKey") ?? "").trim();

  const entries: PackItemEntry[] = [];
  for (let index = 0; index < Math.min(kinds.length, ids.length); index += 1) {
    const kind = kinds[index];
    const id = ids[index]?.trim();
    if (!id) continue;
    if (kind === "set") {
      entries.push({
        kind: "set",
        bundleId: id,
        isPrimary: primaryKey === `set:${id}`,
      });
    } else if (kind === "product") {
      entries.push({
        kind: "product",
        productId: id,
        isPrimary: primaryKey === `product:${id}`,
      });
    }
  }

  // Legacy product-only form fields
  if (entries.length === 0) {
    const productIds = formData.getAll("productIds").map(String).filter(Boolean);
    const primaryId = String(formData.get("primaryProductId") ?? "").trim();
    return [...new Set(productIds)].map((productId) => ({
      kind: "product" as const,
      productId,
      isPrimary: productId === primaryId,
    }));
  }

  return entries;
}

export function parsePackProductEntries(formData: FormData) {
  return parsePackItemEntries(formData)
    .filter((entry): entry is Extract<PackItemEntry, { kind: "product" }> => entry.kind === "product")
    .map((entry) => ({
      productId: entry.productId,
      isPrimary: entry.isPrimary,
    }));
}

export function packItemKey(entry: PackItemEntry) {
  return entry.kind === "set" ? `set:${entry.bundleId}` : `product:${entry.productId}`;
}
