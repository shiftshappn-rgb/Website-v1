import type { CSSProperties } from "react";
import { Link } from "react-router";
import { CardImageCarousel } from "~/components/storefront/CardImageCarousel";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import { formatCurrency } from "~/lib/utils";
import type { ProductCardData } from "~/lib/serialize";

type ProductCardProps = {
  product: ProductCardData;
  cloudName?: string;
  /** Soft gutters above/below the product photo (home + shop cards). */
  padded?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Cap hover images (home best sellers use 2). */
  maxImages?: number;
  showQuickView?: boolean;
};

function ColorSwatches({
  slug,
  colors,
}: {
  slug: string;
  colors: Array<{ name: string; hex: string }>;
}) {
  if (colors.length === 0) return null;

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

export function ProductCard({
  product,
  cloudName,
  padded = true,
  className = "",
  style,
  maxImages = 2,
  showQuickView = true,
}: ProductCardProps) {
  const price = Number(product.basePrice);
  const compareAt = product.compareAtPrice != null ? Number(product.compareAtPrice) : null;
  const colors = product.colors ?? [];
  const href = product.href ?? `/products/${product.slug}`;

  return (
    <article className={`group ${className}`} style={style}>
      <div className="relative mb-3 overflow-hidden rounded-xl shadow-sm transition-shadow duration-300 group-hover:shadow-lg">
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
          maxImages={maxImages}
          padded={padded}
          className="rounded-none"
          imageClassName="transition-opacity duration-300"
        />
        {showQuickView ? (
          <span className="pointer-events-none absolute inset-x-0 bottom-8 z-10 mx-auto w-fit rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-charcoal opacity-0 translate-y-2 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            Quick view
          </span>
        ) : null}
      </div>
      <Link to={href} prefetch="intent" className="block">
        <h3 className="text-sm font-medium text-charcoal transition-colors group-hover:text-navy">
          {product.name}
        </h3>
      </Link>
      <ColorSwatches slug={href} colors={colors} />
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-sm text-charcoal/80">{formatCurrency(price)}</span>
        {compareAt != null && compareAt > price && (
          <span className="text-sm text-charcoal/40 line-through">
            {formatCurrency(compareAt)}
          </span>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  cloudName,
}: {
  products: ProductCardData[];
  cloudName?: string;
}) {
  const revealRef = useScrollReveal<HTMLDivElement>();

  if (products.length === 0) {
    return (
      <p className="py-16 text-center text-charcoal/50">No products found.</p>
    );
  }

  return (
    <div
      ref={revealRef}
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4"
    >
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          cloudName={cloudName}
          className="animate-on-scroll"
          style={
            {
              "--stagger-delay": `${Math.min(index, 11) * 45}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
