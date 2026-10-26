import { Link } from "react-router";
import { CardImageCarousel } from "~/components/storefront/CardImageCarousel";
import { formatCurrency } from "~/lib/utils";
import type { ProductCardData } from "~/lib/serialize";

type ProductCardProps = {
  product: ProductCardData;
  cloudName?: string;
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
    <div className="flex items-center gap-1.5">
      {colors.slice(0, 5).map((color) => (
        <Link
          key={color.name}
          to={`${slug.startsWith("/") ? slug : `/products/${slug}`}?color=${encodeURIComponent(color.name)}`}
          prefetch="intent"
          title={color.name}
          aria-label={`View ${color.name}`}
          className="h-8 w-8 rounded-full border border-charcoal/15 transition-transform hover:scale-110 hover:ring-2 hover:ring-navy/25 sm:h-4 sm:w-4"
          style={{ backgroundColor: color.hex }}
        />
      ))}
      {colors.length > 5 && (
        <span className="text-xs text-charcoal/50">+{colors.length - 5}</span>
      )}
    </div>
  );
}

export function ProductCard({ product, cloudName }: ProductCardProps) {
  const price = Number(product.basePrice);
  const compareAt = product.compareAtPrice != null ? Number(product.compareAtPrice) : null;
  const colors = product.colors ?? [];
  const href = product.href ?? `/products/${product.slug}`;

  return (
    <article className="group">
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
        imageClassName="transition-opacity group-hover:opacity-90"
      />
      <Link to={href} prefetch="intent" className="block">
        <h3 className="mt-3 text-sm font-medium text-charcoal transition-colors line-clamp-2 group-hover:text-navy">
          {product.name}
        </h3>
      </Link>
      <div className="mt-2 space-y-2">
        <ColorSwatches slug={href} colors={colors} />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-navy">
            {formatCurrency(price)}
          </span>
          {compareAt != null && compareAt > price && (
            <span className="text-sm text-charcoal/40 line-through">
              {formatCurrency(compareAt)}
            </span>
          )}
        </div>
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
  if (products.length === 0) {
    return (
      <p className="text-center text-charcoal/50 py-16">
        No products found.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} cloudName={cloudName} />
      ))}
    </div>
  );
}
