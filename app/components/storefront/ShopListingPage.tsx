import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { ProductGrid } from "~/components/storefront/ProductCard";
import {
  ShopFilters,
  type ShopActiveFilters,
  type ShopColorFilter,
  type ShopFabricFilter,
} from "~/components/storefront/ShopFilters";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import type { ProductCardData } from "~/lib/serialize";
import { cn } from "~/lib/utils";

const AUDIENCE_LINKS = [
  { label: "Shop all", href: "/shop" },
  { label: "Women", href: "/shop/women" },
  { label: "Men", href: "/shop/men" },
  { label: "Underscrubs", href: "/shop/underscrubs" },
  { label: "Accessories", href: "/shop/accessories" },
] as const;

export function ShopListingPage({
  title,
  eyebrow = "Shop",
  description,
  countLabel,
  products,
  cloudName,
  filters,
  activeFilters,
  showFilters = true,
  emptyMessage = "Nothing matches these filters yet. Try clearing colour or fabric.",
  children,
}: {
  title: string;
  eyebrow?: string;
  description: string;
  countLabel: string;
  products: ProductCardData[];
  cloudName?: string;
  filters?: {
    colors: ShopColorFilter[];
    fabrics: ShopFabricFilter[];
  };
  activeFilters?: ShopActiveFilters;
  showFilters?: boolean;
  emptyMessage?: string;
  children?: ReactNode;
}) {
  const location = useLocation();
  const revealRef = useScrollReveal<HTMLElement>();

  return (
    <div className="relative overflow-hidden bg-cream">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,rgba(244,237,227,0.95),transparent_58%),linear-gradient(180deg,rgba(29,78,120,0.06),transparent_42%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-16 hidden h-64 w-64 rounded-full bg-sage/15 blur-3xl lg:block"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header ref={revealRef} className="animate-on-scroll max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-navy/70">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-[1.05] text-navy sm:text-5xl lg:text-[3.25rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-charcoal/70">
            {description}
          </p>
        </header>

        <nav
          aria-label="Shop categories"
          className="mt-8 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {AUDIENCE_LINKS.map((link) => {
            const active =
              link.href === "/shop"
                ? location.pathname === "/shop"
                : location.pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                to={link.href}
                prefetch="intent"
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-200",
                  active
                    ? "border-navy bg-navy text-white"
                    : "border-charcoal/15 bg-white/80 text-charcoal backdrop-blur-sm hover:border-navy/40 hover:text-navy"
                )}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {showFilters && filters && activeFilters ? (
          <div className="mt-8 rounded-2xl border border-charcoal/10 bg-white/70 p-4 shadow-[0_18px_50px_-40px_rgba(17,26,34,0.45)] backdrop-blur-sm sm:p-5">
            <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
              <p className="text-sm text-charcoal/60">
                <span className="font-medium text-charcoal">{countLabel}</span>
              </p>
            </div>
            <ShopFilters
              colors={filters.colors}
              fabrics={filters.fabrics}
              activeFilters={activeFilters}
              embedded
            />
          </div>
        ) : (
          <p className="mt-8 text-sm text-charcoal/60">
            <span className="font-medium text-charcoal">{countLabel}</span>
          </p>
        )}

        <div className="mt-8 lg:mt-10">
          {products.length > 0 ? (
            <ProductGrid products={products} cloudName={cloudName} />
          ) : (
            <div
              role="status"
              className="rounded-2xl border border-dashed border-charcoal/15 bg-white/60 px-6 py-16 text-center"
            >
              <p className="font-serif text-2xl text-navy">No products here</p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-charcoal/65">
                {emptyMessage}
              </p>
              <Link
                to="/shop"
                prefetch="intent"
                className="mt-6 inline-flex min-h-11 items-center rounded-full bg-navy px-5 text-sm font-medium text-white transition-colors hover:bg-charcoal"
              >
                Browse shop all
              </Link>
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
