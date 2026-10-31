import { data } from "react-router";
import type { Route } from "./+types/api-search";
import { tryDb } from "~/db.server";
import { productCardSelect } from "~/lib/catalog.server";
import { serializeProductForCard } from "~/lib/serialize.server";
import { allocatePrices } from "~/lib/sets";
import { collectCardImages } from "~/lib/utils";

export type SearchResultItem = {
  id: string;
  name: string;
  href: string;
  price: number;
  imagePublicId: string | null;
  imageAlt: string;
  kind: "product" | "bundle" | "set";
};

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);

  if (q.length < 1) {
    return data({ query: q, results: [] as SearchResultItem[] });
  }

  const db = tryDb();
  if (!db) {
    return data({ query: q, results: [] as SearchResultItem[] });
  }

  const [products, packs, sets] = await Promise.all([
    db.product.findMany({
      where: {
        status: "active",
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { shortDescription: { contains: q, mode: "insensitive" } },
          { category: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 12,
      orderBy: { updatedAt: "desc" },
      select: productCardSelect,
    }),
    db.pack.findMany({
      where: {
        status: "active",
        name: { contains: q, mode: "insensitive" },
      },
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: { select: productCardSelect },
          },
        },
      },
    }),
    db.bundle.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
      },
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: {
        products: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: { select: productCardSelect },
          },
        },
      },
    }),
  ]);

  const results: SearchResultItem[] = [];

  for (const product of products) {
    const card = serializeProductForCard(product);
    results.push({
      id: card.id,
      name: card.name,
      href: `/products/${card.slug}`,
      price: card.basePrice,
      imagePublicId: card.imagePublicId ?? null,
      imageAlt: card.imageAlt ?? card.name,
      kind: "product",
    });
  }

  for (const pack of packs) {
    const packProducts = pack.items
      .map((item) => item.product)
      .filter((product): product is NonNullable<typeof product> => product != null);
    if (packProducts.length === 0) continue;

    const parts = packProducts.map((product) => serializeProductForCard(product).basePrice);
    const price = allocatePrices(parts, pack.discountType, Number(pack.discountValue)).total;

    const images = collectCardImages(
      packProducts.map((product) => product.variants),
      pack.name
    );

    results.push({
      id: pack.id,
      name: pack.name,
      href: `/bundles/${pack.slug}`,
      price,
      imagePublicId: images[0]?.publicId ?? null,
      imageAlt: images[0]?.alt ?? pack.name,
      kind: "bundle",
    });
  }

  for (const set of sets) {
    const parts = set.products.map((row) => serializeProductForCard(row.product).basePrice);
    const price = allocatePrices(parts, set.discountType, Number(set.discountValue)).total;
    const images = collectCardImages(
      set.products.map((row) => row.product.variants),
      set.name
    );

    results.push({
      id: set.id,
      name: set.name,
      href: `/sets/${set.slug}`,
      price,
      imagePublicId: images[0]?.publicId ?? null,
      imageAlt: images[0]?.alt ?? set.name,
      kind: "set",
    });
  }

  return data({ query: q, results: results.slice(0, 16) });
}
