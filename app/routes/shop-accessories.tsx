import type { Route } from "./+types/shop-accessories";
import { ProductGrid } from "~/components/storefront/ProductCard";
import { loadAccessoryProducts } from "~/lib/packs.server";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Accessories — shiftshappn",
    description: "Bottles, caps, bags, and other extras from shiftshappn.",
    path: "/shop/accessories",
  });
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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-navy lg:text-4xl">Accessories</h1>
        <p className="mt-2 text-charcoal/70">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </header>
      <ProductGrid products={products} cloudName={cloudName} />
    </div>
  );
}
