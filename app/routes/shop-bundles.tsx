import type { Route } from "./+types/shop-bundles";
import { BundleGrid } from "~/components/storefront/BundleCard";
import { loadPackCards } from "~/lib/packs.server";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Bundles — shiftshappn",
    description: "Save when you shop products together — scrubs, accessories, and more.",
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
    <div className="bg-gradient-to-b from-sand/80 via-white to-white">
      <div className="mx-auto max-w-350 px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <header className="mb-12 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal/45">
            Shop
          </p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-navy lg:text-4xl">
            Bundles
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-charcoal/60">
            Curated groups with a built-in discount — scrubs, accessories, and the extras you
            reach for on shift.
            {bundles.length > 0
              ? ` ${bundles.length} ${bundles.length === 1 ? "bundle" : "bundles"} available.`
              : ""}
          </p>
        </header>
        <BundleGrid bundles={bundles} cloudName={cloudName} />
      </div>
    </div>
  );
}
