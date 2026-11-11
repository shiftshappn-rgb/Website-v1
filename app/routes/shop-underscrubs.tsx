import type { Route } from "./+types/shop-underscrubs";
import { ShopListingPage } from "~/components/storefront/ShopListingPage";
import { loadShopListing } from "~/lib/catalog.server";
import { catalogHeaders } from "~/lib/http-cache";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Underscrubs — shiftshappn",
    description:
      "Soft underscrubs for under your set — layer up for long shifts without the bulk.",
    path: "/shop/underscrubs",
  });
}

export function headers() {
  return catalogHeaders();
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return loadShopListing({
    underscrubsOnly: true,
    color: url.searchParams.get("color"),
    fabric: url.searchParams.get("fabric"),
    sort: url.searchParams.get("sort") ?? "newest",
  });
}

export default function ShopUnderscrubs({ loaderData }: Route.ComponentProps) {
  const { products, filters, activeFilters, cloudName } = loaderData;

  return (
    <ShopListingPage
      title="Underscrubs"
      eyebrow="Layer"
      description="Soft layers for under your set — sold individually, ready for long shifts."
      countLabel={`${products.length} ${products.length === 1 ? "product" : "products"}`}
      products={products}
      cloudName={cloudName}
      filters={filters}
      activeFilters={activeFilters}
      emptyMessage="No underscrubs listed yet. Browse sets while we restock."
    />
  );
}
