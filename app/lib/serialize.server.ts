import type { Prisma } from "@prisma/client";
import { getVariantPrice, parseVariantImages } from "~/lib/utils";
import type { ProductCardData } from "~/lib/serialize";

export type { ProductCardData, SerializedProduct } from "~/lib/serialize";
export { getProductColors, getProductPrimaryImage } from "~/lib/serialize";

const productInclude = {
  variants: true,
  category: true,
  fabricType: true,
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

export function serializeDecimal(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return null;
  return typeof value === "number" ? value : Number(value);
}

export function serializeProduct(product: ProductWithRelations) {
  const basePrice = Number(product.basePrice);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    shortDescription: product.shortDescription,
    basePrice,
    compareAtPrice: serializeDecimal(product.compareAtPrice),
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    seoImage: product.seoImage,
    category: product.category
      ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
      : null,
    fabricType: product.fabricType
      ? {
          id: product.fabricType.id,
          name: product.fabricType.name,
          slug: product.fabricType.slug,
          description: product.fabricType.description,
        }
      : null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      colorName: variant.colorName,
      colorHex: variant.colorHex,
      size: variant.size,
      sku: variant.sku,
      price: getVariantPrice(basePrice, serializeDecimal(variant.priceOverride)),
      inventoryQty: variant.inventoryQty,
      images: parseVariantImages(variant.images),
    })),
  };
}

export function serializeProductForCard(
  product: {
    id: string;
    slug: string;
    name: string;
    shortDescription?: string | null;
    basePrice: import("@prisma/client/runtime/library").Decimal | number;
    compareAtPrice?: import("@prisma/client/runtime/library").Decimal | number | null;
    variants: Array<{
      colorName: string;
      colorHex: string;
      images: unknown;
      priceOverride?: import("@prisma/client/runtime/library").Decimal | number | null;
    }>;
  }
): ProductCardData {
  const basePrice = Number(product.basePrice);
  const compareAtPrice = product.compareAtPrice != null ? Number(product.compareAtPrice) : null;

  const colors: Array<{ name: string; hex: string }> = [];
  const seen = new Set<string>();
  const prices: number[] = [];
  for (const v of product.variants) {
    prices.push(getVariantPrice(basePrice, serializeDecimal(v.priceOverride)));
    if (!seen.has(v.colorName)) {
      seen.add(v.colorName);
      colors.push({ name: v.colorName, hex: v.colorHex });
    }
  }

  let imagePublicId: string | undefined;
  let imageAlt: string | undefined;
  for (const v of product.variants) {
    const images = parseVariantImages(v.images);
    if (images.length > 0) {
      imagePublicId = images[0].publicId;
      imageAlt = images[0].altText;
      break;
    }
  }

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription ?? null,
    basePrice: prices.length > 0 ? Math.min(...prices) : basePrice,
    compareAtPrice,
    colors,
    imagePublicId,
    imageAlt: imageAlt ?? product.name,
  };
}
