import type { Route } from "./+types/shop-bundles";
import { BundleGrid } from "~/components/storefront/BundleCard";
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
    bundles: await loadPackCards(),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

export default function ShopBundles({ loaderData }: Route.ComponentProps) {
  const { bundles, cloudName } = loaderData;

  return (
    <div className="mx-auto max-w-350 px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-charcoal lg:text-4xl">
          Bundles
        </h1>
        <p className="mt-2 text-sm text-charcoal/60">
          Sets paired with the extras you reach for on shift.
          {bundles.length > 0
            ? ` · ${bundles.length} ${bundles.length === 1 ? "bundle" : "bundles"}`
            : ""}
        </p>
      </header>
      <BundleGrid bundles={bundles} cloudName={cloudName} />
    </div>
  );
}
