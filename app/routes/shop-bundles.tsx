import type { Route } from "./+types/shop-bundles";
import { ProductGrid } from "~/components/storefront/ProductCard";
import { loadPackCards } from "~/lib/packs.server";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Bundles — shiftshappn",
    description: "Scrub sets paired with bottles, caps, bags, and other extras.",
    path: "/shop/bundles",
  });
}

export async function loader() {
  return {
    products: await loadPackCards(),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

export default function ShopBundles({ loaderData }: Route.ComponentProps) {
  const { products, cloudName } = loaderData;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-navy lg:text-4xl">Bundles</h1>
        <p className="mt-2 text-charcoal/70">
          {products.length} {products.length === 1 ? "bundle" : "bundles"}
        </p>
      </header>
      {products.length === 0 ? (
        <p className="py-16 text-center text-charcoal/50">No bundles yet.</p>
      ) : (
        <ProductGrid products={products} cloudName={cloudName} />
      )}
    </div>
  );
}
