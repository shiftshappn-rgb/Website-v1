import type { Route } from "./+types/shop-index";
import { ShopListingPage } from "~/components/storefront/ShopListingPage";
import { loadShopListing } from "~/lib/catalog.server";
import { catalogHeaders } from "~/lib/http-cache";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Shop all — shiftshappn",
    description:
      "Browse scrub sets, underscrubs, and accessories — soft stretch, Canadian made.",
    path: "/shop",
  });
}

export function headers() {
  return catalogHeaders();
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return loadShopListing({
    color: url.searchParams.get("color"),
    fabric: url.searchParams.get("fabric"),
    sort: url.searchParams.get("sort") ?? "newest",
  });
}

export default function ShopIndex({ loaderData }: Route.ComponentProps) {
  const { products, filters, activeFilters, cloudName } = loaderData;

  return (
    <ShopListingPage
      title="Shop all"
      description="Sets for the floor, underscrubs underneath, and the extras that round out a shift."
      countLabel={`${products.length} ${products.length === 1 ? "product" : "products"}`}
      products={products}
      cloudName={cloudName}
      filters={filters}
      activeFilters={activeFilters}
    />
  );
}
