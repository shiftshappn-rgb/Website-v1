import type { Route } from "./+types/home";
import { BlockRenderer } from "~/components/homepage-blocks/BlockRenderer";
import type {
  ProductGridContent,
  ProductSummary,
} from "~/components/homepage-blocks/types";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { loadProductGridBlockProducts } from "~/lib/catalog.server";
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

function toProductSummary(product: (typeof demoProducts)[number]): ProductSummary {
  const seen = new Set<string>();
  const colors = product.variants
    .filter((variant) => {
      if (seen.has(variant.colorName)) return false;
      seen.add(variant.colorName);
      return true;
    })
    .map((variant) => ({ name: variant.colorName, hex: variant.colorHex }));

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice,
    colors,
    imagePublicId: product.variants[0]?.images[0]?.publicId,
    imageAlt: product.variants[0]?.images[0]?.altText ?? product.name,
  };
}

function demoProductsForGrid(content: ProductGridContent): ProductSummary[] {
  const all = demoProducts.map(toProductSummary);
  if (content.productSlugs?.length) {
    const bySlug = new Map(all.map((product) => [product.slug, product]));
    return content.productSlugs
      .map((slug) => bySlug.get(slug))
      .filter((product): product is ProductSummary => product != null);
  }
  return all;
}

async function loadProductsByBlockId(
  blocks: Array<{ id: string; type: string; content: Record<string, unknown> }>
) {
  const productGridBlocks = blocks.filter((block) => block.type === "productGrid");
  const entries = await Promise.all(
    productGridBlocks.map(async (block) => {
      const content = block.content as ProductGridContent;
      const products = await loadProductGridBlockProducts(content);
      return [block.id, products] as const;
    })
  );
  return Object.fromEntries(entries) as Record<string, ProductSummary[]>;
}

export async function loader() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!isDatabaseAvailable()) {
    const productsByBlockId = Object.fromEntries(
      demoHomepageBlocks
        .filter((block) => block.type === "productGrid")
        .map((block) => [
          block.id,
          demoProductsForGrid(block.content as ProductGridContent),
        ])
    );

    return {
      blocks: demoHomepageBlocks,
      productsByBlockId,
      cloudName,
    };
  }

  const db = tryDb();
  if (!db) {
    return {
      blocks: demoHomepageBlocks,
      productsByBlockId: {},
      cloudName,
    };
  }

  const blocks = await db.homepageBlock.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });

  const mappedBlocks = blocks.map((block) => ({
    id: block.id,
    type: block.type,
    order: block.order,
    content: block.content as Record<string, unknown>,
    isActive: block.isActive,
  }));

  const productsByBlockId = await loadProductsByBlockId(mappedBlocks);

  return {
    blocks: mappedBlocks,
    productsByBlockId,
    cloudName,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { blocks, productsByBlockId, cloudName } = loaderData;

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <BlockRenderer
        blocks={blocks}
        cloudName={cloudName}
        productsByBlockId={productsByBlockId}
      />
    </>
  );
}
