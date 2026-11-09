import { tryDb } from "~/db.server";
import type { BundleCardData, PackShowcaseSummary } from "~/lib/packs";
import { productCardSelect } from "~/lib/catalog.server";
import { serializeProductForCard } from "~/lib/serialize.server";
import type { ProductCardData } from "~/lib/serialize";
import { allocatePrices } from "~/lib/sets";
import { collectCardImages, parseVariantImages } from "~/lib/utils";

export async function loadAccessoryProducts(): Promise<ProductCardData[]> {
  const db = tryDb();
  if (!db) return [];

  const rows = await db.product.findMany({
    where: { status: "active", category: { slug: "accessories" } },
    select: productCardSelect,
    orderBy: { name: "asc" },
  });

  return rows.map(serializeProductForCard);
}

function firstVariantImage(variants: Array<{ images: unknown }>) {
  for (const variant of variants) {
    const image = parseVariantImages(variant.images)[0];
    if (image) return image.publicId;
  }
  return undefined;
}

function firstPieceImage(
  variants: Array<{ images: unknown }>,
  alt: string
): { publicId: string; alt: string } | null {
  const publicId = firstVariantImage(variants);
  if (!publicId) return null;
  return { publicId, alt };
}

type PackProductPiece = {
  id: string;
  name: string;
  basePrice: number;
  isPrimary: boolean;
  variants: Array<{ colorName: string; colorHex: string; images: unknown }>;
};

export type PackItemRow = {
  isPrimary: boolean;
  sortOrder: number;
  product: {
    id: string;
    name: string;
    basePrice: { toString(): string } | number;
    status: string;
    variants: Array<{ colorName: string; colorHex: string; images: unknown }>;
  } | null;
  bundle: {
    id?: string;
    name: string;
    products: Array<{
      role: string;
      sortOrder: number;
      product: {
        id: string;
        name: string;
        basePrice: { toString(): string } | number;
        status?: string;
        variants: Array<{ colorName: string; colorHex: string; images: unknown }>;
      };
    }>;
  } | null;
};

export type StorefrontPackProductUnit = {
  kind: "product";
  id: string;
  name: string;
  basePrice: number;
  isPrimary: boolean;
  variants: Array<{ colorName: string; colorHex: string; images: unknown }>;
};

export type StorefrontPackSetUnit = {
  kind: "set";
  bundleId: string;
  name: string;
  isPrimary: boolean;
  top: {
    id: string;
    name: string;
    basePrice: number;
    variants: Array<{ colorName: string; colorHex: string; images: unknown }>;
  };
  pants: {
    id: string;
    name: string;
    basePrice: number;
    variants: Array<{ colorName: string; colorHex: string; images: unknown }>;
  };
};

export type StorefrontPackUnit = StorefrontPackProductUnit | StorefrontPackSetUnit;

function sortSetPieces<T extends { role: string; sortOrder: number }>(pieces: T[]) {
  return [...pieces].sort((a, b) => {
    if (a.role === "top" && b.role !== "top") return -1;
    if (b.role === "top" && a.role !== "top") return 1;
    return a.sortOrder - b.sortOrder;
  });
}

/** Typed units for PDP: sets stay as one configure block. */
export function resolveStorefrontPackUnits(items: PackItemRow[]): StorefrontPackUnit[] {
  const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const units: Array<StorefrontPackUnit & { sortOrder: number }> = [];

  for (const item of ordered) {
    if (item.product && item.product.status === "active") {
      units.push({
        kind: "product",
        id: item.product.id,
        name: item.product.name,
        basePrice: Number(item.product.basePrice),
        isPrimary: item.isPrimary,
        variants: item.product.variants,
        sortOrder: item.sortOrder,
      });
      continue;
    }

    if (!item.bundle) continue;
    const pieces = sortSetPieces(item.bundle.products).filter(
      (piece) => piece.product.status !== "archived"
    );
    const top = pieces.find((piece) => piece.role === "top")?.product;
    const pants = pieces.find((piece) => piece.role === "pants")?.product;
    if (!top || !pants) continue;

    units.push({
      kind: "set",
      bundleId: item.bundle.id ?? item.bundle.name,
      name: item.bundle.name,
      isPrimary: item.isPrimary,
      top: {
        id: top.id,
        name: top.name,
        basePrice: Number(top.basePrice),
        variants: top.variants,
      },
      pants: {
        id: pants.id,
        name: pants.name,
        basePrice: Number(pants.basePrice),
        variants: pants.variants,
      },
      sortOrder: item.sortOrder,
    });
  }

  if (units.length === 0) return [];

  const hasPrimary = units.some((unit) => unit.isPrimary);
  return units
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    })
    .map((unit, index) => {
      const { sortOrder: _sortOrder, ...rest } = unit;
      return {
        ...rest,
        isPrimary: hasPrimary ? unit.isPrimary : index === 0,
      };
    });
}

/** Expand all pack items to product pieces (sets → top + pants) for cards/pricing. */
export function resolveStorefrontPackProducts(items: PackItemRow[]): PackProductPiece[] {
  const units = resolveStorefrontPackUnits(items);
  const pieces: PackProductPiece[] = [];

  for (const unit of units) {
    if (unit.kind === "product") {
      pieces.push({
        id: unit.id,
        name: unit.name,
        basePrice: unit.basePrice,
        isPrimary: unit.isPrimary,
        variants: unit.variants,
      });
      continue;
    }

    pieces.push({
      id: unit.top.id,
      name: unit.top.name,
      basePrice: unit.top.basePrice,
      isPrimary: unit.isPrimary,
      variants: unit.top.variants,
    });
    pieces.push({
      id: unit.pants.id,
      name: unit.pants.name,
      basePrice: unit.pants.basePrice,
      isPrimary: false,
      variants: unit.pants.variants,
    });
  }

  return pieces;
}

const packItemsInclude = {
  orderBy: { sortOrder: "asc" as const },
  include: {
    bundle: {
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                basePrice: true,
                status: true,
                variants: { select: { colorName: true, colorHex: true, images: true } },
              },
            },
          },
        },
      },
    },
    product: {
      select: {
        id: true,
        name: true,
        basePrice: true,
        status: true,
        variants: { select: { colorName: true, colorHex: true, images: true } },
      },
    },
  },
};

function toCard(pack: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  discountType: "fixed" | "percent";
  discountValue: { toString(): string } | number;
  items: PackItemRow[];
}): BundleCardData | null {
  const products = resolveStorefrontPackProducts(pack.items);
  if (products.length < 2) return null;

  const parts = products.map((product) => product.basePrice);
  const priced = allocatePrices(parts, pack.discountType, Number(pack.discountValue));
  const undiscounted = parts.reduce((sum, price) => sum + price, 0);

  const ordered = [
    ...products.filter((product) => product.isPrimary),
    ...products.filter((product) => !product.isPrimary),
  ];

  const pieceImages = ordered
    .map((product) => firstPieceImage(product.variants, product.name))
    .filter((piece): piece is { publicId: string; alt: string } => Boolean(piece));

  if (pieceImages.length < 2) {
    const images = collectCardImages(
      ordered.map((product) => product.variants),
      pack.name
    );
    for (const image of images) {
      if (pieceImages.some((piece) => piece.publicId === image.publicId)) continue;
      pieceImages.push({ publicId: image.publicId, alt: image.alt });
      if (pieceImages.length >= 4) break;
    }
  }

  return {
    id: pack.id,
    name: pack.name,
    basePrice: priced.total,
    compareAtPrice: priced.total < undiscounted ? undiscounted : null,
    pieceImages: pieceImages.slice(0, 4),
    href: `/bundles/${pack.slug}`,
  };
}

export async function loadPackCards(): Promise<BundleCardData[]> {
  const db = tryDb();
  if (!db) return [];

  const packs = await db.pack.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    include: { items: packItemsInclude },
  });

  return packs.flatMap((pack) => {
    const card = toCard(pack);
    return card ? [card] : [];
  });
}

export async function loadPackShowcaseBySlugs(slugs: string[]): Promise<PackShowcaseSummary[]> {
  const db = tryDb();
  if (!db || slugs.length === 0) return [];

  const packs = await db.pack.findMany({
    where: { status: "active", slug: { in: slugs } },
    include: { items: packItemsInclude },
  });
  const bySlug = new Map(packs.map((pack) => [pack.slug, pack]));

  return slugs.flatMap((slug) => {
    const pack = bySlug.get(slug);
    if (!pack) return [];
    const products = resolveStorefrontPackProducts(pack.items);
    if (products.length < 2) return [];

    const parts = products.map((product) => product.basePrice);
    const priced = allocatePrices(parts, pack.discountType, Number(pack.discountValue));
    const undiscounted = parts.reduce((sum, price) => sum + price, 0);
    const ordered = [
      ...products.filter((product) => product.isPrimary),
      ...products.filter((product) => !product.isPrimary),
    ];
    const images = collectCardImages(
      ordered.map((product) => product.variants),
      pack.name
    );
    const pieceImages = ordered
      .map((product) => firstPieceImage(product.variants, product.name))
      .filter((piece): piece is { publicId: string; alt: string } => Boolean(piece));

    if (pieceImages.length < 2) {
      for (const image of images) {
        if (pieceImages.some((piece) => piece.publicId === image.publicId)) continue;
        pieceImages.push({ publicId: image.publicId, alt: image.alt });
        if (pieceImages.length >= 4) break;
      }
    }

    return [
      {
        id: pack.id,
        slug: pack.slug,
        name: pack.name,
        description: pack.description,
        basePrice: priced.total,
        compareAtPrice: priced.total < undiscounted ? undiscounted : null,
        href: `/bundles/${pack.slug}`,
        imagePublicId: pieceImages[0]?.publicId ?? images[0]?.publicId,
        imageAlt: pieceImages[0]?.alt ?? images[0]?.alt ?? pack.name,
        images,
        pieceImages: pieceImages.slice(0, 4),
        items: ordered.map((product) => ({
          kind: product.isPrimary ? ("primary" as const) : ("extra" as const),
          name: product.name,
          imagePublicId: firstVariantImage(product.variants),
        })),
      },
    ];
  });
}
