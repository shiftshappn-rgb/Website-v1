import type { ReactNode } from "react";
import type { Route } from "./+types/shiftknit";
import {
  ArrowRight,
  Ban,
  Leaf,
  MapPin,
  Maximize2,
  Ruler,
  Shirt,
  Tag,
} from "lucide-react";
import { Link } from "react-router";
import { ProductCard } from "~/components/storefront/ProductCard";
import { loadShopListing } from "~/lib/catalog.server";
import { buildMeta } from "~/lib/seo";
import {
  AT_A_GLANCE,
  FIBRE_FEATURES,
  HOW_IT_WORKS,
  MOMENTS,
  SHIFTKNIT_COMPOSITION,
  SHIFTKNIT_FAQS,
} from "~/lib/shiftknit-content";
import type { ProductCardData } from "~/lib/serialize";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "SHIFTKNIT™ — shiftshappn",
    description:
      "What is SHIFTKNIT™? A soft, stretchy fabric made for 12-hour shifts — 72% polyester, 21% rayon, 7% spandex.",
    path: "/shiftknit",
  });
}

export async function loader({}: Route.LoaderArgs) {
  const [women, men] = await Promise.all([
    loadShopListing({ categorySlug: "women", sort: "newest" }),
    loadShopListing({ categorySlug: "men", sort: "newest" }),
  ]);

  return {
    womenProducts: women.products,
    menProducts: men.products,
    cloudName: women.cloudName ?? men.cloudName,
  };
}

function PhotoPlaceholder({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl border border-dashed border-charcoal/20 bg-stone/60 px-4 text-center text-xs leading-relaxed text-charcoal/45 ${className}`}
    >
      {label}
    </div>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky">
      {children}
    </p>
  );
}

function GlanceIcon({ icon }: { icon: (typeof AT_A_GLANCE)[number]["icon"] }) {
  const className = "size-4 shrink-0 text-sky";
  switch (icon) {
    case "stretch":
      return <Maximize2 className={className} aria-hidden />;
    case "leaf":
      return <Leaf className={className} aria-hidden />;
    case "shape":
      return <Shirt className={className} aria-hidden />;
    case "ban":
      return <Ban className={className} aria-hidden />;
    case "hanger":
      return <Shirt className={className} aria-hidden />;
    case "ruler":
      return <Ruler className={className} aria-hidden />;
    case "tag":
      return <Tag className={className} aria-hidden />;
    case "pin":
      return <MapPin className={className} aria-hidden />;
  }
}

function CompositionLine({
  highlight,
}: {
  highlight?: "72% polyester" | "21% rayon" | "7% spandex";
}) {
  const parts = [
    { key: "72% polyester" as const, text: "72% polyester" },
    { key: "21% rayon" as const, text: "21% rayon" },
    { key: "7% spandex" as const, text: "7% spandex" },
  ];
  return (
    <p className="text-sm text-charcoal/55">
      {parts.map((part, i) => (
        <span key={part.key}>
          {i > 0 ? " · " : null}
          <span
            className={
              highlight === part.key ? "font-semibold text-charcoal" : undefined
            }
          >
            {part.text}
          </span>
        </span>
      ))}
    </p>
  );
}

function ProductRow({
  title,
  products,
  cloudName,
}: {
  title: string;
  products: ProductCardData[];
  cloudName?: string;
}) {
  return (
    <div className="mt-10 first:mt-0">
      <h3 className="mb-5 font-serif text-2xl text-navy">{title}</h3>
      {products.length === 0 ? (
        <p className="text-sm text-charcoal/50">No sets in this category yet.</p>
      ) : (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <div
              key={product.id}
              className="w-[70%] shrink-0 sm:w-auto sm:shrink"
            >
              <ProductCard product={product} cloudName={cloudName} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShiftKnitPage({ loaderData }: Route.ComponentProps) {
  const { womenProducts, menProducts, cloudName } = loaderData;

  return (
    <div className="bg-cream text-charcoal">
      {/* Intro */}
      <section className="border-b border-charcoal/8">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8 lg:py-16">
          <div>
            <SectionEyebrow>The fabric in every shiftshappn scrub</SectionEyebrow>
            <h1 className="mt-3 font-serif text-4xl leading-tight text-navy sm:text-5xl">
              What is SHIFTKNIT™?
            </h1>
            <div className="mt-4 h-1.5 w-24 rounded-full bg-gold" aria-hidden />
            <p className="mt-6 text-lg font-semibold text-navy">
              A soft, stretchy fabric made for 12-hour shifts.
            </p>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-charcoal/70">
              Built for movement and durability from handover to handover — so your
              scrubs keep up when the day doesn&apos;t slow down.
            </p>
            <p className="mt-5 text-sm text-charcoal/55">{SHIFTKNIT_COMPOSITION}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#shop"
                className="inline-flex items-center justify-center rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy/90"
              >
                Shop SHIFTKNIT™ scrubs
              </a>
              <Link
                to="/faq"
                prefetch="intent"
                className="inline-flex items-center justify-center rounded-full border border-navy/25 bg-white px-6 py-3 text-sm font-semibold text-navy transition-colors hover:border-navy/50"
              >
                See the next Shift Drop
              </Link>
            </div>
          </div>
          <PhotoPlaceholder
            label="PHOTO · Two healthcare workers in ShiftsHappn scrubs, one women's set and one men's, on a plain light background."
            className="min-h-[22rem] lg:min-h-[28rem]"
          />
        </div>
      </section>

      {/* Everyday moments */}
      <section className="border-b border-charcoal/8">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <SectionEyebrow>Everyday moments</SectionEyebrow>
          <h2 className="mt-3 max-w-xl font-serif text-3xl text-navy sm:text-4xl">
            Made for every part of your shift
          </h2>
          <p className="mt-3 max-w-xl text-charcoal/65">
            SHIFTKNIT™ is designed around the moments that are hardest on your scrubs.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MOMENTS.map((moment) => (
              <article key={moment.time} className="flex flex-col">
                <PhotoPlaceholder
                  label={moment.photo}
                  className="aspect-[4/5] w-full"
                />
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky">
                  {moment.time}
                </p>
                <h3 className="mt-1 font-serif text-xl text-navy">{moment.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/65">
                  {moment.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Key features */}
      <section className="border-b border-charcoal/8 bg-sand/40">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <SectionEyebrow>Key features</SectionEyebrow>
          <h2 className="mt-3 font-serif text-3xl text-navy sm:text-4xl">
            Three fibres. Three jobs.
          </h2>
          <div className="mt-10 space-y-5">
            {FIBRE_FEATURES.map((fibre) => (
              <article
                key={fibre.label}
                className="grid overflow-hidden rounded-2xl bg-white shadow-[0_1px_0_rgba(17,26,34,0.06)] sm:grid-cols-2"
              >
                <PhotoPlaceholder
                  label={fibre.photo}
                  className="min-h-[12rem] rounded-none border-0 sm:min-h-[14rem]"
                />
                <div className="flex flex-col justify-center p-6 sm:p-8">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-charcoal/45">
                    {fibre.label}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl text-navy">
                    {fibre.headline}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-charcoal/65">
                    {fibre.body}
                  </p>
                  <div className="mt-5">
                    <CompositionLine highlight={fibre.highlight} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* At a glance */}
      <section className="border-b border-charcoal/8">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <SectionEyebrow>At a glance</SectionEyebrow>
          <h2 className="mt-3 font-serif text-3xl text-navy sm:text-4xl">
            Everything SHIFTKNIT™ does
          </h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {AT_A_GLANCE.map((item) => (
              <li
                key={item.label}
                className="inline-flex items-center gap-2.5 rounded-full border border-charcoal/10 bg-white px-4 py-3 text-sm font-medium text-navy"
              >
                <GlanceIcon icon={item.icon} />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Reviews */}
      <section className="border-b border-charcoal/8 bg-sand/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <SectionEyebrow>Real reviews</SectionEyebrow>
          <h2 className="mt-3 font-serif text-3xl text-navy sm:text-4xl">
            What nurses are saying
          </h2>
          <p className="mt-3 max-w-xl text-charcoal/65">
            Reviews from real ShiftsHappn customers appear here after the first Shift
            Drop.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-dashed border-charcoal/20 bg-white px-5 py-8 text-sm text-charcoal/40"
              >
                [Real customer review]
                <br />
                [First name · role · hospital]
              </div>
            ))}
          </div>
          <Link
            to="/community"
            prefetch="intent"
            className="mt-6 inline-flex text-sm font-semibold text-sky underline underline-offset-4 hover:text-navy"
          >
            Wearing SHIFTKNIT™ already? Leave a review →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky">
            How it works
          </p>
          <h2 className="mt-3 font-serif text-3xl sm:text-4xl">
            One fabric, three fibres
          </h2>
          <p className="mt-3 max-w-xl text-white/70">
            SHIFTKNIT™ blends three fibres into one fabric. Each one does a different
            job.
          </p>

          <div className="mt-8 flex h-4 overflow-hidden rounded-full">
            {HOW_IT_WORKS.map((fibre) => (
              <div
                key={fibre.pct}
                className={fibre.barClass}
                style={{ width: fibre.width }}
                title={fibre.pct}
              />
            ))}
          </div>
          <div className="mt-2 flex text-[10px] uppercase tracking-wider text-white/50">
            {HOW_IT_WORKS.map((fibre) => (
              <span key={fibre.pct} style={{ width: fibre.width }} className="px-1">
                {fibre.pct.split(" ")[0]}
              </span>
            ))}
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((fibre) => (
              <div key={fibre.pct}>
                <div className={`mb-3 h-1 w-12 rounded-full ${fibre.barClass}`} />
                <h3 className="font-serif text-xl text-white">{fibre.pct}</h3>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky">
                  {fibre.role}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  {fibre.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop from DB */}
      <section id="shop" className="border-b border-charcoal/8 scroll-mt-24">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <SectionEyebrow>Shop SHIFTKNIT™</SectionEyebrow>
          <h2 className="mt-3 font-serif text-3xl text-navy sm:text-4xl">
            Find your SHIFTKNIT™ scrubs
          </h2>
          <p className="mt-3 max-w-xl text-charcoal/65">
            Every style is made in SHIFTKNIT™, in sizes up to 3XL. One price, never on
            sale.
          </p>
          <ProductRow
            title="Women's"
            products={womenProducts}
            cloudName={cloudName}
          />
          <ProductRow title="Men's" products={menProducts} cloudName={cloudName} />
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-charcoal/8 bg-sand/40">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <SectionEyebrow>FAQ</SectionEyebrow>
          <h2 className="mt-3 font-serif text-3xl text-navy sm:text-4xl">
            Questions about SHIFTKNIT™
          </h2>
          <div className="mt-8 divide-y divide-charcoal/10">
            {SHIFTKNIT_FAQS.map((faq, index) => (
              <details key={faq.q} className="group py-1" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center gap-3 py-4 font-medium text-navy">
                  <ArrowRight className="size-4 shrink-0 text-sky transition-transform group-open:rotate-90" />
                  {faq.q}
                </summary>
                <p className="pb-4 pl-7 text-sm leading-relaxed text-charcoal/70">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom nav cards */}
      <section className="bg-cream">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8 lg:py-12">
          {[
            { label: "Women's scrubs", to: "/shop/women", filled: false },
            { label: "Men's scrubs", to: "/shop/men", filled: false },
            { label: "Size guide", to: "/size-chart", filled: false },
            { label: "Shift Drop schedule", to: "/faq", filled: true },
          ].map((item) => (
            <Link
              key={item.to + item.label}
              to={item.to}
              prefetch="intent"
              className={`flex items-center justify-between rounded-2xl px-5 py-5 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${
                item.filled
                  ? "bg-navy text-white"
                  : "border border-navy/20 bg-white text-navy"
              }`}
            >
              <span className="max-w-[10rem] leading-snug">{item.label}</span>
              <span aria-hidden>→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
