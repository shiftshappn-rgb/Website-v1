import type { CSSProperties } from "react";
import { Link } from "react-router";
import { CardImageCarousel } from "~/components/storefront/CardImageCarousel";
import { formatCurrency } from "~/lib/utils";
import type { ProductSummary } from "./types";

function ColorSwatches({
  slug,
  colors,
}: {
  slug: string;
  colors?: ProductSummary["colors"];
}) {
  if (!colors?.length) return null;

  return (
    <div className="mt-2 flex items-center gap-1.5">
      {colors.slice(0, 5).map((color) => (
        <Link
          key={color.name}
          to={`${slug.startsWith("/") ? slug : `/products/${slug}`}?color=${encodeURIComponent(color.name)}`}
          prefetch="intent"
          title={color.name}
          aria-label={`View ${color.name}`}
          className="h-8 w-8 rounded-full border border-charcoal/15 transition-transform hover:scale-110 hover:ring-2 hover:ring-navy/25 sm:h-3.5 sm:w-3.5"
          style={{ backgroundColor: color.hex }}
        />
      ))}
      {colors.length > 5 && (
        <span className="text-xs text-charcoal/50">+{colors.length - 5}</span>
      )}
    </div>
  );
}

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
  const href = product.href ?? `/products/${product.slug}`;

  return (
    <article className={`group ${className}`} style={style}>
      <div className="relative mb-3 shadow-sm transition-shadow duration-300 group-hover:shadow-lg">
        <CardImageCarousel
          images={
            product.images?.length
              ? product.images
              : product.imagePublicId
                ? [{ publicId: product.imagePublicId, alt: product.imageAlt ?? product.name }]
                : []
          }
          alt={product.imageAlt ?? product.name}
          href={href}
          cloudName={cloudName}
          imageClassName="transition-transform duration-500 group-hover:scale-105"
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-8 z-10 mx-auto w-fit rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-charcoal opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
          Quick view
        </span>
      </div>
      <Link to={href} prefetch="intent" className="block">
        <h3 className="text-sm font-medium text-charcoal transition-colors group-hover:text-navy">
          {product.name}
        </h3>
      </Link>
      <ColorSwatches slug={href} colors={product.colors} />
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-sm text-charcoal/80">
          {formatCurrency(Number(product.basePrice))}
        </span>
        {product.compareAtPrice != null && Number(product.compareAtPrice) > 0 && (
          <span className="text-sm text-charcoal/40 line-through">
            {formatCurrency(Number(product.compareAtPrice))}
          </span>
        )}
      </div>
    </article>
  );
}
