import type { VariantImage } from "~/lib/utils";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  colors: Array<{ name: string; hex: string }>;
  imagePublicId?: string;
  imageAlt?: string;
};

export type SerializedVariant = {
  id: string;
  colorName: string;
  colorHex: string;
  size: string;
  sku: string;
  price: number;
  inventoryQty: number;
  images: VariantImage[];
};

export type SerializedProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoImage: string | null;
  category: { id: string; name: string; slug: string } | null;
  fabricType: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  } | null;
  variants: SerializedVariant[];
};

export function getProductColors(
  product: SerializedProduct | { variants: Array<{ colorName: string; colorHex: string }> }
) {
  const seen = new Set<string>();
  return product.variants.filter((v) => {
    if (seen.has(v.colorName)) return false;
    seen.add(v.colorName);
    return true;
  });
}

export function getProductPrimaryImage(product: SerializedProduct) {
  for (const variant of product.variants) {
    const images = variant.images;
    if (images.length > 0) {
      return images[0];
    }
  }
  return null;
}
