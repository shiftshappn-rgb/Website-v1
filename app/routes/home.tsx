import type { Route } from "./+types/home";
import { BlockRenderer } from "~/components/homepage-blocks/BlockRenderer";
import type { ProductSummary } from "~/components/homepage-blocks/types";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { loadProductsByCollectionSlugs } from "~/lib/catalog.server";
import {
  demoHomepageBlocks,
  demoProducts,
} from "~/lib/demo-data.server";
import { buildMeta, JsonLd, organizationJsonLd } from "~/lib/seo";

export function meta(): Route.MetaDescriptors {
  return buildMeta({
    title: "shiftshappn — Premium Canadian Medical Scrubs",
    description:
      "Soft, stretch scrubs with pockets that actually hold what you carry. Canadian made. Free shipping over $100 CAD.",
    path: "/",
  });
}

export async function loader() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!isDatabaseAvailable()) {
    const productsByCollection: Record<string, ProductSummary[]> = {
      "best-sellers": demoProducts.map((p) => {
        const seen = new Set<string>();
        const colors = p.variants
          .filter((v) => {
            if (seen.has(v.colorName)) return false;
            seen.add(v.colorName);
            return true;
          })
          .map((v) => ({ name: v.colorName, hex: v.colorHex }));

        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          shortDescription: p.shortDescription,
          basePrice: p.basePrice,
          compareAtPrice: p.compareAtPrice,
          colors,
          imagePublicId: p.variants[0]?.images[0]?.publicId,
          imageAlt: p.variants[0]?.images[0]?.altText ?? p.name,
        };
      }),
    };

    return {
      blocks: demoHomepageBlocks,
      productsByCollection,
      cloudName,
    };
  }

  const db = tryDb();
  if (!db) {
    return {
      blocks: demoHomepageBlocks,
      productsByCollection: {},
      cloudName,
    };
  }

  const blocks = await db.homepageBlock.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });

  const productGridBlocks = blocks.filter((b) => b.type === "productGrid");
  const collectionSlugs = productGridBlocks
    .map((b) => (b.content as { collectionSlug?: string }).collectionSlug)
    .filter(Boolean) as string[];

  const productsByCollection = await loadProductsByCollectionSlugs(collectionSlugs);

  return {
    blocks: blocks.map((b) => ({
      id: b.id,
      type: b.type,
      order: b.order,
      content: b.content as Record<string, unknown>,
      isActive: b.isActive,
    })),
    productsByCollection,
    cloudName,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { blocks, productsByCollection, cloudName } = loaderData;

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <BlockRenderer
        blocks={blocks}
        cloudName={cloudName}
        products={productsByCollection}
      />
    </>
  );
}
