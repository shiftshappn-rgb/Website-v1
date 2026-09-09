import type { Route } from "./+types/shop-fabric";
import { Link } from "react-router";
import { ProductGrid } from "~/components/storefront/ProductCard";
import { loadShopByFabric } from "~/lib/catalog.server";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Shop by fabric — shiftshappn",
    description: "Explore scrubs by fabric type — stretch, antimicrobial, and more.",
    path: "/shop/fabric",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return loadShopByFabric(url.searchParams.get("fabric"));
}

export default function ShopFabric({ loaderData }: Route.ComponentProps) {
  const { fabrics, products, selectedFabric, cloudName } = loaderData;
  const activeFabric = fabrics.find((f) => f.slug === selectedFabric);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <header className="mb-8 lg:mb-12">
        <h1 className="text-3xl lg:text-4xl font-serif text-navy">Shop by fabric</h1>
        <p className="mt-2 text-charcoal/70">Find the perfect fabric for your shifts</p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {fabrics.map((fabric) => (
          <Link
            key={fabric.id}
            to={`?fabric=${fabric.slug}`}
            prefetch="intent"
            className={`p-6 rounded-xl border transition-colors ${
              selectedFabric === fabric.slug
                ? "border-navy bg-white shadow-sm"
                : "border-charcoal/10 bg-white/50 hover:border-navy/40"
            }`}
          >
            <h2 className="text-lg font-serif text-navy">{fabric.name}</h2>
            {fabric.description && (
              <p className="mt-2 text-sm text-charcoal/70">{fabric.description}</p>
            )}
            <p className="mt-3 text-xs text-charcoal/50">
              {fabric.productCount} product{fabric.productCount !== 1 ? "s" : ""}
            </p>
          </Link>
        ))}
      </div>

      {activeFabric ? (
        <>
          <h2 className="text-xl font-serif text-navy mb-6">{activeFabric.name}</h2>
          <ProductGrid products={products} cloudName={cloudName} />
        </>
      ) : (
        <p className="text-center text-charcoal/50 py-12">
          Select a fabric type above to browse products
        </p>
      )}
    </div>
  );
}
