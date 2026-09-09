import type { Route } from "./+types/shop-women";
import { Link, useSearchParams } from "react-router";
import { ProductGrid } from "~/components/storefront/ProductCard";
import { SortSelect } from "~/components/storefront/SortSelect";
import { loadShopListing } from "~/lib/catalog.server";
import { buildMeta } from "~/lib/seo";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Women's scrubs — shiftshappn",
    description: "Shop women's medical scrubs designed for comfort and style.",
    path: "/shop/women",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return loadShopListing({
    categorySlug: "women",
    color: url.searchParams.get("color"),
    fabric: url.searchParams.get("fabric"),
    sort: url.searchParams.get("sort") ?? "newest",
  });
}

function FilterLink({
  label,
  param,
  value,
  active,
}: {
  label: string;
  param: string;
  value: string | null;
  active: boolean;
}) {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  if (value) params.set(param, value);
  else params.delete(param);
  const qs = params.toString();

  return (
    <Link
      to={qs ? `?${qs}` : "."}
      prefetch="intent"
      className={cn(
        "px-3 py-1.5 rounded-full text-sm border transition-colors",
        active
          ? "bg-navy text-white border-navy"
          : "border-charcoal/20 text-charcoal hover:border-navy"
      )}
    >
      {label}
    </Link>
  );
}

export default function ShopWomen({ loaderData }: Route.ComponentProps) {
  const { products, filters, activeFilters, cloudName } = loaderData;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-serif text-navy">Women</h1>
          <p className="mt-2 text-charcoal/70">{products.length} products</p>
        </div>
        <SortSelect value={activeFilters.sort} />
      </header>

      <div className="flex flex-wrap gap-2 mb-8">
        <FilterLink label="All colors" param="color" value={null} active={!activeFilters.color} />
        {filters.colors.map((c) => (
          <FilterLink key={c} label={c} param="color" value={c} active={activeFilters.color === c} />
        ))}
      </div>

      {filters.fabrics.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <FilterLink label="All fabrics" param="fabric" value={null} active={!activeFilters.fabric} />
          {filters.fabrics.map((f) => (
            <FilterLink
              key={f.slug}
              label={f.name}
              param="fabric"
              value={f.slug}
              active={activeFilters.fabric === f.slug}
            />
          ))}
        </div>
      )}

      <ProductGrid products={products} cloudName={cloudName} />
    </div>
  );
}
