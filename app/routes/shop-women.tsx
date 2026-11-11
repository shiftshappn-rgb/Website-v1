import type { Route } from "./+types/shop-women";
import { ShopListingPage } from "~/components/storefront/ShopListingPage";
import { loadShopListing } from "~/lib/catalog.server";
import { catalogHeaders } from "~/lib/http-cache";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Women's scrubs — shiftshappn",
    description: "Shop women's scrub sets and underscrubs designed for comfort and style.",
    path: "/shop/women",
  });
}

export function headers() {
  return catalogHeaders();
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return loadShopListing({
    categorySlug: "women",
    color: url.searchParams.get("color"),
    fabric: url.searchParams.get("fabric"),
    sort: url.searchParams.get("sort") ?? "newest",
  });
}

export default function ShopWomen({ loaderData }: Route.ComponentProps) {
  const { products, filters, activeFilters, cloudName } = loaderData;

  return (
    <ShopListingPage
      title="Women"
      eyebrow="Women’s shop"
      description="Soft stretch sets and underscrubs built for long shifts — pockets that actually hold what you carry."
      countLabel={`${products.length} ${products.length === 1 ? "product" : "products"}`}
      products={products}
      cloudName={cloudName}
      filters={filters}
      activeFilters={activeFilters}
    />
  );
}
