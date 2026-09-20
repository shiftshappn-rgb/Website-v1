import type { Prisma } from "@prisma/client";
import { tryDb } from "~/db.server";
import { serializeProductForCard } from "~/lib/serialize.server";
import type { ProductCardData } from "~/lib/serialize";

export const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  basePrice: true,
  compareAtPrice: true,
  fabricType: { select: { slug: true, name: true } },
  variants: {
    select: {
      colorName: true,
      colorHex: true,
      images: true,
      priceOverride: true,
    },
  },
} satisfies Prisma.ProductSelect;

type FilterSource = {
  fabricType: { slug: string; name: string } | null;
  variants: Array<{ colorName: string; colorHex?: string }>;
};

function categoryWhere(slug?: string): Prisma.ProductWhereInput {
  if (!slug) return {};
  return {
    OR: [
      { category: { slug } },
      { category: { parent: { slug } } },
    ],
  };
}

function productOrderBy(sort: string): Prisma.ProductOrderByWithRelationInput {
  if (sort === "price-asc") return { basePrice: "asc" };
  if (sort === "price-desc") return { basePrice: "desc" };
  return { createdAt: "desc" };
}

function deriveFilters(products: FilterSource[]) {
  const colorMap = new Map<string, string>();
  for (const product of products) {
    for (const variant of product.variants) {
      if (!colorMap.has(variant.colorName)) {
        colorMap.set(variant.colorName, variant.colorHex ?? "#CCCCCC");
      }
    }
  }

  const colors = [...colorMap.entries()]
    .map(([name, hex]) => ({ name, hex }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const fabricMap = new Map<string, string>();
  for (const product of products) {
    if (product.fabricType) fabricMap.set(product.fabricType.slug, product.fabricType.name);
  }

  return {
    colors,
    fabrics: [...fabricMap.entries()].map(([slug, name]) => ({ slug, name })),
  };
}

export type ShopListingResult = {
  products: ProductCardData[];
  filters: {
    colors: Array<{ name: string; hex: string }>;
    fabrics: Array<{ slug: string; name: string }>;
  };
  activeFilters: { color: string | null; fabric: string | null; sort: string };
  cloudName: string | undefined;
};

export async function loadShopListing(opts: {
  categorySlug?: string;
  color?: string | null;
  fabric?: string | null;
  sort?: string;
}): Promise<ShopListingResult> {
  const color = opts.color ?? null;
  const fabric = opts.fabric ?? null;
  const sort = opts.sort ?? "newest";
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const empty: ShopListingResult = {
    products: [],
    filters: { colors: [], fabrics: [] },
    activeFilters: { color, fabric, sort },
    cloudName,
  };

  const db = tryDb();
  if (!db) return empty;

  const categoryFilter = categoryWhere(opts.categorySlug);
  const listingWhere: Prisma.ProductWhereInput = {
    status: "active",
    ...categoryFilter,
    ...(fabric ? { fabricType: { slug: fabric } } : {}),
    ...(color ? { variants: { some: { colorName: color } } } : {}),
  };

  if (!color && !fabric) {
    const rows = await db.product.findMany({
      where: listingWhere,
      select: productCardSelect,
      orderBy: productOrderBy(sort),
    });

    return {
      products: rows.map(serializeProductForCard),
      filters: deriveFilters(rows),
      activeFilters: { color, fabric, sort },
      cloudName,
    };
  }

  const [rows, filterRows] = await Promise.all([
    db.product.findMany({
      where: listingWhere,
      select: productCardSelect,
      orderBy: productOrderBy(sort),
    }),
    db.product.findMany({
      where: { status: "active", ...categoryFilter },
      select: {
        fabricType: { select: { slug: true, name: true } },
        variants: { select: { colorName: true, colorHex: true } },
      },
    }),
  ]);

  return {
    products: rows.map(serializeProductForCard),
    filters: deriveFilters(filterRows),
    activeFilters: { color, fabric, sort },
    cloudName,
  };
}

export async function loadCollectionProducts(slug: string): Promise<ProductCardData[]> {
  const db = tryDb();
  if (!db) return [];

  const collection = await db.collection.findUnique({
    where: { slug },
    select: {
      products: {
        orderBy: { sortOrder: "asc" },
        select: {
          product: {
            select: {
              status: true,
              ...productCardSelect,
            },
          },
        },
      },
    },
  });

  if (!collection) return [];

  return collection.products
    .filter((pc) => pc.product.status === "active")
    .map((pc) => serializeProductForCard(pc.product));
}

export async function loadProductsByCollectionSlugs(slugs: string[]) {
  const unique = [...new Set(slugs)];
  const pairs = await Promise.all(
    unique.map(async (slug) => [slug, await loadCollectionProducts(slug)] as const)
  );
  return Object.fromEntries(pairs) as Record<string, ProductCardData[]>;
}

export async function loadProductGridBlockProducts(content: {
  productSlugs?: string[];
  collectionSlug?: string;
}) {
  if (content.productSlugs?.length) {
    return loadProductsBySlugs(content.productSlugs);
  }
  if (content.collectionSlug) {
    return loadCollectionProducts(content.collectionSlug);
  }
  return [] as ProductCardData[];
}

export async function loadProductsBySlugs(slugs: string[]) {
  const db = tryDb();
  if (!db || slugs.length === 0) return [] as ProductCardData[];

  const rows = await db.product.findMany({
    where: { slug: { in: slugs }, status: "active" },
    select: productCardSelect,
  });

  const bySlug = new Map(rows.map((row) => [row.slug, serializeProductForCard(row)]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((product): product is ProductCardData => product != null);
}

export async function loadCollectionPage(slug: string) {
  const db = tryDb();
  if (!db) return null;

  const collection = await db.collection.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      heroImage: true,
      seoTitle: true,
      seoDescription: true,
      products: {
        orderBy: { sortOrder: "asc" },
        select: {
          product: {
            select: {
              status: true,
              ...productCardSelect,
            },
          },
        },
      },
    },
  });

  if (!collection) return null;

  return {
    collection: {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      heroImage: collection.heroImage,
      seoTitle: collection.seoTitle,
      seoDescription: collection.seoDescription,
    },
    products: collection.products
      .filter((pc) => pc.product.status === "active")
      .map((pc) => serializeProductForCard(pc.product)),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

export async function loadShopByColour(selectedColor: string | null) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const db = tryDb();
  if (!db) {
    return {
      colors: [] as Array<{ name: string; hex: string; count: number }>,
      products: [] as ProductCardData[],
      selectedColor,
      cloudName,
    };
  }

  const [variants, rows] = await Promise.all([
    db.productVariant.findMany({
      where: { product: { status: "active" } },
      select: { colorName: true, colorHex: true },
    }),
    selectedColor
      ? db.product.findMany({
          where: {
            status: "active",
            variants: { some: { colorName: selectedColor } },
          },
          select: productCardSelect,
        })
      : Promise.resolve([]),
  ]);

  const colorMap = new Map<string, { hex: string; count: number }>();
  for (const v of variants) {
    const existing = colorMap.get(v.colorName);
    if (existing) {
      existing.count += 1;
    } else {
      colorMap.set(v.colorName, { hex: v.colorHex, count: 1 });
    }
  }

  const colors = [...colorMap.entries()]
    .map(([name, { hex, count }]) => ({ name, hex, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    colors,
    products: rows.map(serializeProductForCard),
    selectedColor,
    cloudName,
  };
}

export async function loadShopByFabric(fabricSlug: string | null) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const db = tryDb();
  if (!db) {
    return {
      fabrics: [] as Array<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        productCount: number;
      }>,
      products: [] as ProductCardData[],
      selectedFabric: fabricSlug,
      cloudName,
    };
  }

  const [fabricTypes, rows] = await Promise.all([
    db.fabricType.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        _count: { select: { products: { where: { status: "active" } } } },
      },
    }),
    fabricSlug
      ? db.product.findMany({
          where: { status: "active", fabricType: { slug: fabricSlug } },
          select: productCardSelect,
        })
      : Promise.resolve([]),
  ]);

  return {
    fabrics: fabricTypes.map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      description: f.description,
      productCount: f._count.products,
    })),
    products: rows.map(serializeProductForCard),
    selectedFabric: fabricSlug,
    cloudName,
  };
}
