import type { Route } from "./+types/shop-colour";
import { Link } from "react-router";
import { ProductGrid } from "~/components/storefront/ProductCard";
import { loadShopByColour } from "~/lib/catalog.server";
import { buildMeta } from "~/lib/seo";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Shop by colour — shiftshappn",
    description: "Find medical scrubs in your favourite colours.",
    path: "/shop/colour",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return loadShopByColour(url.searchParams.get("color"));
}

export default function ShopColour({ loaderData }: Route.ComponentProps) {
  const { colors, products, selectedColor, cloudName } = loaderData;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <header className="mb-8 lg:mb-12">
        <h1 className="text-3xl lg:text-4xl font-serif text-navy">Shop by colour</h1>
        <p className="mt-2 text-charcoal/70">Select a colour to browse matching scrubs</p>
      </header>

      <div className="mb-12 grid grid-cols-3 gap-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {colors.map((color) => (
          <Link
            key={color.name}
            to={`?color=${encodeURIComponent(color.name)}`}
            prefetch="intent"
            className={cn(
              "flex flex-col items-center gap-2 group",
              selectedColor === color.name && "opacity-100"
            )}
          >
            <span
              className={cn(
                "w-12 h-12 rounded-full border-2 transition-transform group-hover:scale-110",
                selectedColor === color.name ? "border-navy ring-2 ring-navy/30" : "border-charcoal/15"
              )}
              style={{ backgroundColor: color.hex }}
            />
            <span className="text-xs text-charcoal/70 text-center">{color.name}</span>
          </Link>
        ))}
      </div>

      {selectedColor ? (
        <>
          <h2 className="text-xl font-serif text-navy mb-6">{selectedColor}</h2>
          <ProductGrid products={products} cloudName={cloudName} />
        </>
      ) : (
        <p className="text-center text-charcoal/50 py-12">
          Choose a colour above to see products
        </p>
      )}
    </div>
  );
}
