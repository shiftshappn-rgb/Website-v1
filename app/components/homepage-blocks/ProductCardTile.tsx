import type { CSSProperties } from "react";
import { ProductCard } from "~/components/storefront/ProductCard";
import type { ProductSummary } from "./types";

export function ProductCardTile({
  product,
  cloudName,
  className = "",
  style,
}: {
  product: ProductSummary;
  cloudName?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <ProductCard
      product={{
        id: product.id,
        slug: product.slug,
        name: product.name,
        shortDescription: product.shortDescription ?? null,
        basePrice: Number(product.basePrice),
        compareAtPrice:
          product.compareAtPrice != null ? Number(product.compareAtPrice) : null,
        colors: product.colors ?? [],
        imagePublicId: product.imagePublicId,
        imageAlt: product.imageAlt,
        images: product.images,
        href: product.href,
      }}
      cloudName={cloudName}
      className={className}
      style={style}
      padded
      maxImages={2}
      showQuickView
    />
  );
}
