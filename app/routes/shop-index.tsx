import type { Route } from "./+types/shop-index";
import { ProductGrid } from "~/components/storefront/ProductCard";
import { loadShopListing } from "~/lib/catalog.server";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Shop all — shiftshappn",
    description: "Browse all premium medical scrubs from shiftshappn.",
    path: "/shop",
  });
}

export async function loader({}: Route.LoaderArgs) {
  const { products, cloudName } = await loadShopListing({});
  return { products, cloudName };
}

export default function ShopIndex({ loaderData }: Route.ComponentProps) {
  const { products, cloudName } = loaderData;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <header className="mb-8 lg:mb-12">
        <h1 className="text-3xl lg:text-4xl font-serif text-navy">Shop all</h1>
        <p className="mt-2 text-charcoal/70">Premium scrubs for every shift</p>
      </header>
      <ProductGrid products={products} cloudName={cloudName} />
    </div>
  );
}
