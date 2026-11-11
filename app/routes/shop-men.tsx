import type { Route } from "./+types/shop-men";
import { ShopListingPage } from "~/components/storefront/ShopListingPage";
import { loadShopListing } from "~/lib/catalog.server";
import { catalogHeaders } from "~/lib/http-cache";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Men's scrubs — shiftshappn",
    description:
      "Shop men's scrub sets and underscrubs designed for comfort and durability.",
    path: "/shop/men",
  });
}

export function headers() {
  return catalogHeaders();
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
    <ShopListingPage
      title="Men"
      eyebrow="Men’s shop"
      description="Clean lines, full range of motion — men’s sets and underscrubs for the long haul."
      countLabel={`${products.length} ${products.length === 1 ? "product" : "products"}`}
      products={products}
      cloudName={cloudName}
      filters={filters}
      activeFilters={activeFilters}
    />
  );
}
