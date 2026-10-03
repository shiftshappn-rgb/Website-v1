import type { CSSProperties } from "react";
import { Link } from "react-router";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import { ProductCardTile } from "./ProductCardTile";
import { ProductCarousel } from "./ProductCarousel";
import type {
  BlockCommonProps,
  ProductGridContent,
  ProductSummary,
} from "./types";

export function ProductGridBlock({
  content,
  products = [],
  cloudName,
}: BlockCommonProps & {
  content: ProductGridContent;
  products?: ProductSummary[];
}) {
  const revealRef = useScrollReveal<HTMLElement>();
  const layout = content.layout ?? "grid";
  const viewAllHref = content.collectionSlug
    ? `/collections/${content.collectionSlug}`
    : "/shop";

  const gridCols =
    products.length <= 3
      ? "grid-cols-2 lg:grid-cols-3"
      : "grid-cols-2 lg:grid-cols-4";

  return (
    <section ref={revealRef} className="section-white py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-8 lg:mb-10">
          <h2 className="animate-on-scroll text-xl lg:text-2xl font-sans font-semibold text-charcoal">
            {content.headline}
          </h2>
          <Link
            to={viewAllHref}
            prefetch="intent"
            className="hidden sm:inline-flex text-sm font-medium text-navy hover:text-terracotta transition-colors"
          >
            View all
          </Link>
        </div>

        {products.length > 0 ? (
          layout === "carousel" ? (
            <ProductCarousel products={products} cloudName={cloudName} />
          ) : (
            <div className={`grid ${gridCols} gap-4 lg:gap-8`}>
              {products.map((product, index) => (
                <ProductCardTile
                  key={product.id}
                  product={product}
                  cloudName={cloudName}
                  className="animate-on-scroll"
                  style={{ "--stagger-delay": `${index * 50}ms` } as CSSProperties}
                />
              ))}
            </div>
          )
        ) : (
          <p className="text-center text-charcoal/50 py-12">
            No products selected yet.
          </p>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link
            to={viewAllHref}
            prefetch="intent"
            className="inline-flex text-sm font-medium text-navy hover:text-terracotta transition-colors"
          >
            View all
          </Link>
        </div>
      </div>
    </section>
  );
}
