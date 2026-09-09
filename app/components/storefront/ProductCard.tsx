import { Link } from "react-router";
import { formatCurrency } from "~/lib/utils";
import type { ProductCardData } from "~/lib/serialize";

type ProductCardProps = {
  product: ProductCardData;
  cloudName?: string;
};

function ProductImage({
  publicId,
  alt,
  cloudName,
}: {
  publicId?: string;
  alt: string;
  cloudName?: string;
}) {
  const src = publicId
    ? publicId.startsWith("http")
      ? publicId
      : `https://res.cloudinary.com/${cloudName ?? "demo"}/image/upload/f_auto,q_auto,w_600/${publicId}`
    : null;

  if (!src) {
    return <div className="aspect-[3/4] w-full bg-stone rounded-xl" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="aspect-[3/4] w-full object-cover rounded-xl transition-opacity group-hover:opacity-90"
    />
  );
}

export function ProductCard({ product, cloudName }: ProductCardProps) {
  const price = Number(product.basePrice);
  const compareAt = product.compareAtPrice != null ? Number(product.compareAtPrice) : null;
  const colors = product.colors ?? [];

  return (
    <Link to={`/products/${product.slug}`} prefetch="intent" className="group block">
      <ProductImage
        publicId={product.imagePublicId}
        alt={product.imageAlt ?? product.name}
        cloudName={cloudName}
      />
      <div className="mt-3 space-y-2">
        <h3 className="text-sm font-medium text-charcoal group-hover:text-navy transition-colors line-clamp-2">
          {product.name}
        </h3>
        {colors.length > 0 && (
          <div className="flex items-center gap-1.5">
            {colors.slice(0, 5).map((color) => (
              <span
                key={color.name}
                title={color.name}
                className="w-4 h-4 rounded-full border border-charcoal/15"
                style={{ backgroundColor: color.hex }}
              />
            ))}
            {colors.length > 5 && (
              <span className="text-xs text-charcoal/50">+{colors.length - 5}</span>
            )}
          </div>
        )}
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
    </Link>
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
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} cloudName={cloudName} />
      ))}
    </div>
  );
}
