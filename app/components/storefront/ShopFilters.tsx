import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { SlidersHorizontal, X } from "lucide-react";
import { SortSelect } from "~/components/storefront/SortSelect";
import { cn } from "~/lib/utils";

export type ShopColorFilter = {
  name: string;
  hex: string;
};

export type ShopFabricFilter = {
  slug: string;
  name: string;
};

export type ShopActiveFilters = {
  color: string | null;
  fabric: string | null;
  sort: string;
};

function FilterLink({
  to,
  active,
  children,
  className,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      prefetch="intent"
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
        active
          ? "border-navy bg-navy text-white"
          : "border-charcoal/15 bg-white text-charcoal hover:border-navy",
        className
      )}
    >
      {children}
    </Link>
  );
}

function buildFilterHref(
  searchParams: URLSearchParams,
  updates: Record<string, string | null>
) {
  const params = new URLSearchParams(searchParams);
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : ".";
}

export function ShopFilters({
  colors,
  fabrics,
  activeFilters,
}: {
  colors: ShopColorFilter[];
  fabrics: ShopFabricFilter[];
  activeFilters: ShopActiveFilters;
}) {
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeColor = colors.find((color) => color.name === activeFilters.color);
  const activeFabric = fabrics.find((fabric) => fabric.slug === activeFilters.fabric);
  const activeCount = [activeFilters.color, activeFilters.fabric].filter(Boolean).length;

  return (
    <div className="mb-8 border-t border-charcoal/10 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/15 bg-white px-3.5 py-2 text-sm font-medium text-charcoal lg:hidden"
          aria-expanded={open}
        >
          <SlidersHorizontal size={16} />
          Filter
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-navy px-1.5 text-[11px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </button>
        <div className="w-full sm:ml-auto sm:w-auto">
          <SortSelect value={activeFilters.sort} />
        </div>
      </div>

      <div className={cn("mt-5 space-y-5", open ? "block" : "hidden lg:block")}>
        {colors.length > 0 && (
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-charcoal/50">
              Colour
            </p>
            <div className="flex flex-wrap gap-2">
              <FilterLink
                to={buildFilterHref(searchParams, { color: null })}
                active={!activeFilters.color}
              >
                All colours
              </FilterLink>
              {colors.map((color) => (
                <FilterLink
                  key={color.name}
                  to={buildFilterHref(searchParams, { color: color.name })}
                  active={activeFilters.color === color.name}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-charcoal/20"
                    style={{ backgroundColor: color.hex }}
                    aria-hidden
                  />
                  {color.name}
                </FilterLink>
              ))}
            </div>
          </div>
        )}

        {fabrics.length > 0 && (
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-charcoal/50">
              Fabric
            </p>
            <div className="flex flex-wrap gap-2">
              <FilterLink
                to={buildFilterHref(searchParams, { fabric: null })}
                active={!activeFilters.fabric}
              >
                All fabrics
              </FilterLink>
              {fabrics.map((fabric) => (
                <FilterLink
                  key={fabric.slug}
                  to={buildFilterHref(searchParams, { fabric: fabric.slug })}
                  active={activeFilters.fabric === fabric.slug}
                >
                  {fabric.name}
                </FilterLink>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeCount > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-charcoal/10 pt-4">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-charcoal/45">
            Filtering by
          </span>
          {activeColor && (
            <Link
              to={buildFilterHref(searchParams, { color: null })}
              prefetch="intent"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-sand px-2.5 py-1.5 text-sm text-charcoal"
            >
              <span
                className="h-2.5 w-2.5 rounded-full border border-charcoal/15"
                style={{ backgroundColor: activeColor.hex }}
                aria-hidden
              />
              {activeColor.name}
              <X size={14} className="text-charcoal/50" />
            </Link>
          )}
          {activeFabric && (
            <Link
              to={buildFilterHref(searchParams, { fabric: null })}
              prefetch="intent"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-sand px-2.5 py-1.5 text-sm text-charcoal"
            >
              {activeFabric.name}
              <X size={14} className="text-charcoal/50" />
            </Link>
          )}
          <Link
            to={buildFilterHref(searchParams, { color: null, fabric: null })}
            prefetch="intent"
            className="text-sm font-medium text-navy hover:text-terracotta"
          >
            Clear all
          </Link>
        </div>
      )}
    </div>
  );
}
