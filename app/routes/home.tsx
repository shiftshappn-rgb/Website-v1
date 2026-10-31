import type { Route } from "./+types/home";
import { BlockRenderer } from "~/components/homepage-blocks/BlockRenderer";
import type {
  PackShowcaseContent,
  ProductGridContent,
  ProductSummary,
} from "~/components/homepage-blocks/types";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { loadProductGridsByBlockId } from "~/lib/catalog.server";
import {
  demoHomepageBlocks,
  demoProducts,
} from "~/lib/demo-data.server";
import type { PackShowcaseSummary } from "~/lib/packs";
import { loadPackShowcaseBySlugs } from "~/lib/packs.server";
import { catalogHeaders } from "~/lib/http-cache";
import { buildMeta, JsonLd, organizationJsonLd } from "~/lib/seo";

export function meta(): Route.MetaDescriptors {
  return buildMeta({
    title: "shiftshappn — Premium Canadian Medical Scrubs",
    description:
      "Soft, stretch scrubs with pockets that actually hold what you carry. Canadian made. Free Shift Drop in Halifax.",
    path: "/",
  });
}

export function headers() {
  return catalogHeaders();
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
    shortDescription: product.shortDescription ?? undefined,
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice,
    colors,
    imagePublicId: product.variants[0]?.images[0]?.publicId,
    imageAlt: product.variants[0]?.images[0]?.altText ?? product.name,
    images: product.variants.flatMap((variant) =>
      variant.images.map((image) => ({
        publicId: image.publicId,
        alt: image.altText || product.name,
      }))
    ),
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

async function loadPacksByBlockId(
  blocks: Array<{ id: string; type: string; content: Record<string, unknown> }>
) {
  const showcaseBlocks = blocks.filter((block) => block.type === "packShowcase");
  const entries = await Promise.all(
    showcaseBlocks.map(async (block) => {
      const content = block.content as unknown as PackShowcaseContent;
      const packs = await loadPackShowcaseBySlugs(content.packSlugs ?? []);
      return [block.id, packs] as const;
    })
  );
  return Object.fromEntries(entries) as Record<string, PackShowcaseSummary[]>;
}

export async function loader() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!isDatabaseAvailable()) {
    const productsByBlockId = Object.fromEntries(
      demoHomepageBlocks
        .filter((block) => block.type === "productGrid")
        .map((block) => [
          block.id,
          demoProductsForGrid(block.content as unknown as ProductGridContent),
        ])
    );

    return {
      blocks: demoHomepageBlocks,
      productsByBlockId,
      packsByBlockId: {},
      cloudName,
    };
  }

  const db = tryDb();
  if (!db) {
    return {
      blocks: demoHomepageBlocks,
      productsByBlockId: {},
      packsByBlockId: {},
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

  const [productsByBlockId, packsByBlockId] = await Promise.all([
    loadProductGridsByBlockId(mappedBlocks),
    loadPacksByBlockId(mappedBlocks),
  ]);

  return {
    blocks: mappedBlocks,
    productsByBlockId,
    packsByBlockId,
    cloudName,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { blocks, productsByBlockId, packsByBlockId, cloudName } = loaderData;

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <BlockRenderer
        blocks={blocks}
        cloudName={cloudName}
        productsByBlockId={productsByBlockId as Record<string, ProductSummary[]>}
        packsByBlockId={packsByBlockId}
      />
    </>
  );
}
