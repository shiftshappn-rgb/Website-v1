import type { Route } from "./+types/shop-men";
import { ProductGrid } from "~/components/storefront/ProductCard";
import { ShopFilters } from "~/components/storefront/ShopFilters";
import { loadShopListing } from "~/lib/catalog.server";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Men's scrubs — shiftshappn",
    description: "Shop men's medical scrubs designed for comfort and durability.",
    path: "/shop/men",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return loadShopListing({
    categorySlug: "men",
    color: url.searchParams.get("color"),
    fabric: url.searchParams.get("fabric"),
    sort: url.searchParams.get("sort") ?? "newest",
  });
}

export default function ShopMen({ loaderData }: Route.ComponentProps) {
  const { products, filters, activeFilters, cloudName } = loaderData;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <header className="mb-2">
        <h1 className="text-3xl lg:text-4xl font-serif text-navy">Men</h1>
        <p className="mt-2 text-charcoal/70">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </header>
      <ShopFilters
        colors={filters.colors}
        fabrics={filters.fabrics}
        activeFilters={activeFilters}
      />
      <ProductGrid products={products} cloudName={cloudName} />
    </div>
  );
}
