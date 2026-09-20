import type { CSSProperties } from "react";
import { Link } from "react-router";
import { formatCurrency } from "~/lib/utils";
import { BlockImage } from "./BlockImage";
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
          to={`/products/${slug}?color=${encodeURIComponent(color.name)}`}
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
  return (
    <article className={`group ${className}`} style={style}>
      <Link to={`/products/${product.slug}`} prefetch="intent" className="block">
        <div className="relative mb-3 overflow-hidden rounded-xl bg-stone shadow-sm transition-shadow duration-300 group-hover:shadow-lg">
          <BlockImage
            publicId={product.imagePublicId}
            alt={product.imageAlt ?? product.name}
            width={500}
            cloudName={cloudName}
            className="aspect-3/4 w-full object-cover transition-transform duration-500 group-hover:scale-105 bg-stone"
            placeholderClassName="aspect-3/4 w-full bg-stone"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-charcoal opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
            Quick view
          </span>
        </div>
        <h3 className="text-sm font-medium text-charcoal transition-colors group-hover:text-navy">
          {product.name}
        </h3>
      </Link>
      <ColorSwatches slug={product.slug} colors={product.colors} />
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
