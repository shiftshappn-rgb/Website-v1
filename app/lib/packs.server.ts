import { tryDb } from "~/db.server";
import type { BundleCardData, PackShowcaseSummary } from "~/lib/packs";
import { productCardSelect } from "~/lib/catalog.server";
import { serializeProductForCard } from "~/lib/serialize.server";
import type { ProductCardData } from "~/lib/serialize";
import { allocatePrices, piecePrices } from "~/lib/sets";
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

export async function loadPackCards(): Promise<BundleCardData[]> {
  const db = tryDb();
  if (!db) return [];

  const packs = await db.pack.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          bundle: {
            include: {
              products: {
                include: {
                  product: {
                    select: {
                      name: true,
                      basePrice: true,
                      variants: { select: { colorName: true, colorHex: true, images: true } },
                    },
                  },
                },
              },
            },
          },
          product: {
            select: {
              name: true,
              basePrice: true,
              status: true,
              variants: { select: { colorName: true, colorHex: true, images: true } },
            },
          },
        },
      },
    },
  });

  return packs.flatMap((pack) => {
    const setItem = pack.items.find((item) => item.bundle);
    const top = setItem?.bundle?.products.find((piece) => piece.role === "top")?.product;
    const pants = setItem?.bundle?.products.find((piece) => piece.role === "pants")?.product;
    if (!setItem?.bundle || !top || !pants) return [];

    const extras = pack.items
      .filter((item) => item.product && item.product.status === "active")
      .map((item) => item.product!);
    const setPrices = piecePrices(
      Number(top.basePrice),
      Number(pants.basePrice),
      setItem.bundle.discountType,
      Number(setItem.bundle.discountValue)
    );
    const parts = [setPrices.top, setPrices.pants, ...extras.map((extra) => Number(extra.basePrice))];
    const priced = allocatePrices(parts, pack.discountType, Number(pack.discountValue));
    const undiscounted = setPrices.total + extras.reduce((sum, extra) => sum + Number(extra.basePrice), 0);

    const pieceImages = [
      firstPieceImage(top.variants, top.name),
      firstPieceImage(pants.variants, pants.name),
      ...extras.map((extra) => firstPieceImage(extra.variants, extra.name)),
    ].filter((piece): piece is { publicId: string; alt: string } => Boolean(piece));

    // Fall back to flattened gallery if piece images are thin
    if (pieceImages.length < 2) {
      const images = collectCardImages(
        [top.variants, pants.variants, ...extras.map((extra) => extra.variants)],
        pack.name
      );
      for (const image of images) {
        if (pieceImages.some((piece) => piece.publicId === image.publicId)) continue;
        pieceImages.push({ publicId: image.publicId, alt: image.alt });
        if (pieceImages.length >= 4) break;
      }
    }

    return [
      {
        id: pack.id,
        name: pack.name,
        basePrice: priced.total,
        compareAtPrice: priced.total < undiscounted ? undiscounted : null,
        pieceImages: pieceImages.slice(0, 4),
        href: `/bundles/${pack.slug}`,
      },
    ];
  });
}

const packShowcaseInclude = {
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      bundle: {
        include: {
          products: {
            include: {
              product: {
                select: {
                  name: true,
                  basePrice: true,
                  variants: { select: { colorName: true, colorHex: true, images: true } },
                },
              },
            },
          },
        },
      },
      product: {
        select: {
          name: true,
          basePrice: true,
          status: true,
          variants: { select: { colorName: true, colorHex: true, images: true } },
        },
      },
    },
  },
};

export async function loadPackShowcaseBySlugs(slugs: string[]): Promise<PackShowcaseSummary[]> {
  const db = tryDb();
  if (!db || slugs.length === 0) return [];

  const packs = await db.pack.findMany({
    where: { status: "active", slug: { in: slugs } },
    include: packShowcaseInclude,
  });
  const bySlug = new Map(packs.map((pack) => [pack.slug, pack]));

  return slugs.flatMap((slug) => {
    const pack = bySlug.get(slug);
    if (!pack) return [];

    const setItem = pack.items.find((item) => item.bundle);
    const top = setItem?.bundle?.products.find((piece) => piece.role === "top")?.product;
    const pants = setItem?.bundle?.products.find((piece) => piece.role === "pants")?.product;
    if (!setItem?.bundle || !top || !pants) return [];

    const extras = pack.items
      .filter((item) => item.product && item.product.status === "active")
      .map((item) => item.product!);
    const setPrices = piecePrices(
      Number(top.basePrice),
      Number(pants.basePrice),
      setItem.bundle.discountType,
      Number(setItem.bundle.discountValue)
    );
    const parts = [setPrices.top, setPrices.pants, ...extras.map((extra) => Number(extra.basePrice))];
    const priced = allocatePrices(parts, pack.discountType, Number(pack.discountValue));
    const undiscounted = setPrices.total + extras.reduce((sum, extra) => sum + Number(extra.basePrice), 0);
    const images = collectCardImages(
      [top.variants, pants.variants, ...extras.map((extra) => extra.variants)],
      pack.name
    );
    const setImage =
      firstVariantImage(top.variants) ?? firstVariantImage(pants.variants) ?? images[0]?.publicId;

    const pieceImages = [
      firstPieceImage(top.variants, top.name),
      firstPieceImage(pants.variants, pants.name),
      ...extras.map((extra) => firstPieceImage(extra.variants, extra.name)),
    ].filter((piece): piece is { publicId: string; alt: string } => Boolean(piece));

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
        imagePublicId: images[0]?.publicId,
        imageAlt: images[0]?.alt || pack.name,
        images,
        pieceImages: pieceImages.slice(0, 4),
        items: [
          {
            kind: "set" as const,
            name: `${setItem.bundle.name} set`,
            imagePublicId: setImage,
          },
          ...extras.map((extra) => ({
            kind: "extra" as const,
            name: extra.name,
            imagePublicId: firstVariantImage(extra.variants),
          })),
        ],
      },
    ];
  });
}
