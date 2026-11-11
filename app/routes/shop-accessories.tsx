import type { Route } from "./+types/shop-accessories";
import { ShopListingPage } from "~/components/storefront/ShopListingPage";
import { loadAccessoryProducts } from "~/lib/packs.server";
import { catalogHeaders } from "~/lib/http-cache";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Accessories — shiftshappn",
    description: "Bags and extras that round out the shift from shiftshappn.",
    path: "/shop/accessories",
  });
}

export function headers() {
  return catalogHeaders();
}

export async function loader() {
  return {
    products: await loadAccessoryProducts(),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

export default function ShopAccessories({ loaderData }: Route.ComponentProps) {
  const { products, cloudName } = loaderData;

  return (
    <ShopListingPage
      title="Accessories"
      eyebrow="Extras"
      description="The small pieces that make a long shift easier — bags and add-ons sold individually."
      countLabel={`${products.length} ${products.length === 1 ? "product" : "products"}`}
      products={products}
      cloudName={cloudName}
      showFilters={false}
      emptyMessage="No accessories listed yet. Check back soon, or browse scrub sets."
    />
  );
}
