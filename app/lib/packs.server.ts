import { tryDb } from "~/db.server";
import { productCardSelect } from "~/lib/catalog.server";
import { serializeProductForCard } from "~/lib/serialize.server";
import type { ProductCardData } from "~/lib/serialize";
import { allocatePrices, piecePrices } from "~/lib/sets";
import { collectCardImages } from "~/lib/utils";

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

export async function loadPackCards(): Promise<ProductCardData[]> {
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
    const images = collectCardImages(
      [top.variants, pants.variants, ...extras.map((extra) => extra.variants)],
      pack.name
    );
    const colors = new Map<string, string>();
    for (const variant of top.variants) {
      if (pants.variants.some((piece) => piece.colorName === variant.colorName)) {
        colors.set(variant.colorName, variant.colorHex);
      }
    }

    return [
      {
        id: pack.id,
        slug: pack.slug,
        name: pack.name,
        shortDescription: pack.description,
        basePrice: priced.total,
        compareAtPrice: priced.total < undiscounted ? undiscounted : null,
        colors: [...colors.entries()].map(([name, hex]) => ({ name, hex })),
        imagePublicId: images[0]?.publicId,
        imageAlt: images[0]?.alt || pack.name,
        images,
        href: `/bundles/${pack.slug}`,
      },
    ];
  });
}
