import type { Prisma } from "@prisma/client";
import { tryDb } from "~/db.server";
import { serializeProductForCard } from "~/lib/serialize.server";
import type { ProductCardData } from "~/lib/serialize";
import { piecePrices } from "~/lib/sets";
import { collectCardImages, parseVariantImages } from "~/lib/utils";

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

type SetCard = {
  createdAt: Date;
  audience: string | null;
  fabricSlug: string | null;
  fabricName: string | null;
  card: ProductCardData;
};

const setListSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  discountType: true,
  discountValue: true,
  createdAt: true,
  products: {
    select: {
      role: true,
      product: {
        select: {
          ...productCardSelect,
          category: { select: { slug: true, parent: { select: { slug: true } } } },
        },
      },
    },
  },
} satisfies Prisma.BundleSelect;

function sharedColorList(
  top: Array<{ colorName: string; colorHex: string; images: unknown }>,
  pants: Array<{ colorName: string; colorHex: string; images: unknown }>
) {
  const pantsColors = new Set(pants.map((variant) => variant.colorName));
  const seen = new Set<string>();
  const colors: Array<{ name: string; hex: string }> = [];

  function add(variant: { colorName: string; colorHex: string }) {
    if (seen.has(variant.colorName)) return;
    seen.add(variant.colorName);
    colors.push({ name: variant.colorName, hex: variant.colorHex });
  }

  function hasImages(colorName: string) {
    return [...top, ...pants].some(
      (variant) =>
        variant.colorName === colorName && parseVariantImages(variant.images).length > 0
    );
  }

  for (const variant of top) {
    if (pantsColors.has(variant.colorName)) add(variant);
  }
  for (const variant of [...top, ...pants]) {
    if (hasImages(variant.colorName)) add(variant);
  }
  return colors;
}

function toSetCard(
  bundle: Prisma.BundleGetPayload<{ select: typeof setListSelect }>
): SetCard | null {
  const top = bundle.products.find((item) => item.role === "top")?.product;
  const pants = bundle.products.find((item) => item.role === "pants")?.product;
  if (!top || !pants) return null;

  const topPrice = Number(top.basePrice);
  const pantsPrice = Number(pants.basePrice);
  const prices = piecePrices(
    topPrice,
    pantsPrice,
    bundle.discountType,
    Number(bundle.discountValue)
  );
  const images = collectCardImages([top.variants, pants.variants], `${bundle.name} set`);
  const sum = topPrice + pantsPrice;

  return {
    createdAt: bundle.createdAt,
    audience: top.category?.parent?.slug ?? top.category?.slug ?? null,
    fabricSlug: top.fabricType?.slug ?? null,
    fabricName: top.fabricType?.name ?? null,
    card: {
      id: bundle.id,
      slug: bundle.slug,
      name: `${bundle.name} set`,
      shortDescription: bundle.description,
      basePrice: prices.total,
      compareAtPrice: prices.total < sum ? sum : null,
      colors: sharedColorList(top.variants, pants.variants),
      imagePublicId: images[0]?.publicId,
      imageAlt: images[0]?.alt ?? `${bundle.name} set`,
      images,
      href: `/sets/${bundle.slug}`,
    },
  };
}

async function loadSetCards(db: NonNullable<ReturnType<typeof tryDb>>) {
  const bundles = await db.bundle.findMany({
    orderBy: { createdAt: "desc" },
    select: setListSelect,
  });
  return bundles.flatMap((bundle) => {
    const card = toSetCard(bundle);
    return card ? [card] : [];
  });
}

function sortSetCards(sets: SetCard[], sort: string) {
  const copy = [...sets];
  if (sort === "price-asc") copy.sort((a, b) => a.card.basePrice - b.card.basePrice);
  else if (sort === "price-desc") copy.sort((a, b) => b.card.basePrice - a.card.basePrice);
  else copy.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return copy;
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

  const sets = await loadSetCards(db);
  const inAudience = opts.categorySlug
    ? sets.filter((set) => set.audience === opts.categorySlug)
    : sets;
  const filters = deriveFilters(
    inAudience.map((set) => ({
      fabricType:
        set.fabricSlug && set.fabricName
          ? { slug: set.fabricSlug, name: set.fabricName }
          : null,
      variants: set.card.colors.map((colorOption) => ({
        colorName: colorOption.name,
        colorHex: colorOption.hex,
      })),
    }))
  );
  const listed = inAudience.filter((set) => {
    if (fabric && set.fabricSlug !== fabric) return false;
    if (color && !set.card.colors.some((option) => option.name === color)) return false;
    return true;
  });

  return {
    products: sortSetCards(listed, sort).map((set) => set.card),
    filters,
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

export async function loadSetCardsBySlugs(slugs: string[]) {
  const db = tryDb();
  if (!db || slugs.length === 0) return [] as ProductCardData[];

  const unique = [...new Set(slugs)];
  const bundles = await db.bundle.findMany({
    where: { slug: { in: unique } },
    select: setListSelect,
  });
  const bySlug = new Map(
    bundles.flatMap((bundle) => {
      const card = toSetCard(bundle);
      return card ? [[card.card.slug, card.card] as const] : [];
    })
  );
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((card): card is ProductCardData => card != null);
}

export async function loadProductGridBlockProducts(content: {
  productSlugs?: string[];
  collectionSlug?: string;
}) {
  if (content.productSlugs?.length) {
    const bySlug = await resolveProductOrSetCardsBySlugs(content.productSlugs);
    return content.productSlugs
      .map((slug) => bySlug.get(slug))
      .filter((item): item is ProductCardData => item != null);
  }
  if (content.collectionSlug) {
    return loadCollectionProducts(content.collectionSlug);
  }
  return [] as ProductCardData[];
}

/** One batched lookup for many homepage product grids (avoids N full catalog scans). */
export async function loadProductGridsByBlockId(
  blocks: Array<{ id: string; type: string; content: Record<string, unknown> }>
) {
  const grids = blocks.filter((block) => block.type === "productGrid");
  if (grids.length === 0) return {} as Record<string, ProductCardData[]>;

  const slugBlocks: Array<{ id: string; slugs: string[] }> = [];
  const collectionBlocks: Array<{ id: string; collectionSlug: string }> = [];

  for (const block of grids) {
    const content = block.content as {
      productSlugs?: string[];
      collectionSlug?: string;
    };
    if (content.productSlugs?.length) {
      slugBlocks.push({ id: block.id, slugs: content.productSlugs });
    } else if (content.collectionSlug) {
      collectionBlocks.push({ id: block.id, collectionSlug: content.collectionSlug });
    }
  }

  const allSlugs = [...new Set(slugBlocks.flatMap((block) => block.slugs))];
  const [bySlug, collectionResults] = await Promise.all([
    resolveProductOrSetCardsBySlugs(allSlugs),
    Promise.all(
      collectionBlocks.map(async (block) => ({
        id: block.id,
        products: await loadCollectionProducts(block.collectionSlug),
      }))
    ),
  ]);

  const result: Record<string, ProductCardData[]> = {};
  for (const block of slugBlocks) {
    result[block.id] = block.slugs
      .map((slug) => bySlug.get(slug))
      .filter((item): item is ProductCardData => item != null);
  }
  for (const entry of collectionResults) {
    result[entry.id] = entry.products;
  }
  return result;
}

async function resolveProductOrSetCardsBySlugs(slugs: string[]) {
  if (slugs.length === 0) return new Map<string, ProductCardData>();
  const sets = await loadSetCardsBySlugs(slugs);
  const found = new Set(sets.map((set) => set.slug));
  const rest = [...new Set(slugs.filter((slug) => !found.has(slug)))];
  const products = rest.length ? await loadProductsBySlugs(rest) : [];
  return new Map([...sets, ...products].map((item) => [item.slug, item]));
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

  const sets = await loadSetCards(db);
  const colorMap = new Map<string, { hex: string; count: number }>();
  for (const set of sets) {
    for (const color of set.card.colors) {
      const existing = colorMap.get(color.name);
      if (existing) existing.count += 1;
      else colorMap.set(color.name, { hex: color.hex, count: 1 });
    }
  }

  const colors = [...colorMap.entries()]
    .map(([name, { hex, count }]) => ({ name, hex, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    colors,
    products: selectedColor
      ? sets
          .filter((set) => set.card.colors.some((color) => color.name === selectedColor))
          .map((set) => set.card)
      : [],
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

  const [fabricTypes, sets] = await Promise.all([
    db.fabricType.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
      },
    }),
    loadSetCards(db),
  ]);

  return {
    fabrics: fabricTypes.map((fabric) => ({
      id: fabric.id,
      name: fabric.name,
      slug: fabric.slug,
      description: fabric.description,
      productCount: sets.filter((set) => set.fabricSlug === fabric.slug).length,
    })),
    products: fabricSlug
      ? sets.filter((set) => set.fabricSlug === fabricSlug).map((set) => set.card)
      : [],
    selectedFabric: fabricSlug,
    cloudName,
  };
}
