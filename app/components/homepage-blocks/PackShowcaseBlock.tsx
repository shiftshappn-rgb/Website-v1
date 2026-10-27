import { Link } from "react-router";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import { formatCurrency } from "~/lib/utils";
import type { PackShowcaseSummary } from "~/lib/packs";
import type { BlockCommonProps, PackShowcaseContent } from "./types";

export function PackShowcaseBlock({
  content,
  packs = [],
  cloudName,
}: BlockCommonProps & {
  content: PackShowcaseContent;
  packs?: PackShowcaseSummary[];
}) {
  const revealRef = useScrollReveal<HTMLElement>();
  if (packs.length === 0) return null;

  const ctaLabel = content.ctaLabel?.trim() || "Shop bundles";
  const ctaLink = content.ctaLink?.trim() || "/shop/bundles";

  return (
    <section ref={revealRef} className="section-white py-12 lg:py-16">
      <div className="mx-auto w-full max-w-[1800px] px-3 sm:px-5 lg:px-10">
        <div className="mb-8 flex items-end justify-between gap-4 lg:mb-10">
          <div className="animate-on-scroll space-y-2">
            <h2 className="text-xl font-sans font-semibold text-charcoal lg:text-2xl">
              {content.headline}
            </h2>
            {content.body && (
              <p className="max-w-2xl text-sm leading-relaxed text-charcoal/70 sm:text-base">
                {content.body}
              </p>
            )}
          </div>
          <Link
            to={ctaLink}
            prefetch="intent"
            className="hidden shrink-0 text-sm font-medium text-navy transition-colors hover:text-terracotta sm:inline-flex"
          >
            {ctaLabel}
          </Link>
        </div>

        <div className="space-y-10 lg:space-y-14">
          {packs.map((pack) => {
            const heroSrc = pack.imagePublicId
              ? cloudinaryImageUrl(pack.imagePublicId, cloudName, 1200)
              : null;
            const compareAt =
              pack.compareAtPrice != null ? Number(pack.compareAtPrice) : null;
            const price = Number(pack.basePrice);

            return (
              <article
                key={pack.id}
                className="animate-on-scroll grid items-center gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,26rem)] lg:gap-12"
              >
                <Link
                  to={pack.href}
                  prefetch="intent"
                  className="group block overflow-hidden rounded-2xl bg-stone"
                  tabIndex={-1}
                  aria-hidden
                >
                  {heroSrc ? (
                    <img
                      src={heroSrc}
                      alt={pack.imageAlt || pack.name}
                      className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:aspect-[5/4]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="aspect-[4/5] w-full bg-stone sm:aspect-[5/4]" />
                  )}
                </Link>

                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-charcoal">
                      <Link to={pack.href} prefetch="intent" className="hover:text-navy">
                        {pack.name}
                      </Link>
                    </h3>
                    {pack.description && (
                      <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
                        {pack.description}
                      </p>
                    )}
                    <p className="mt-3 text-base font-medium text-navy">
                      {formatCurrency(price)}
                      {compareAt != null && compareAt > price && (
                        <span className="ml-2 text-sm font-normal text-charcoal/40 line-through">
                          {formatCurrency(compareAt)}
                        </span>
                      )}
                    </p>
                  </div>

                  <ul className="space-y-3 border-t border-charcoal/10 pt-5">
                    <li className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal/45">
                      Included
                    </li>
                    {pack.items.map((item) => {
                      const thumb = item.imagePublicId
                        ? cloudinaryImageUrl(item.imagePublicId, cloudName, 160)
                        : null;
                      return (
                        <li key={`${item.kind}-${item.name}`} className="flex items-center gap-3">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="size-12 rounded-lg object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="size-12 rounded-lg bg-stone" aria-hidden />
                          )}
                          <div>
                            <p className="text-sm font-medium text-charcoal">{item.name}</p>
                            <p className="text-xs text-charcoal/50">
                              {item.kind === "set" ? "Scrub set" : "Extra"}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <Link
                    to={pack.href}
                    prefetch="intent"
                    className="inline-flex h-12 items-center justify-center rounded-full bg-charcoal px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition-transform hover:scale-[1.02] hover:bg-charcoal/90"
                  >
                    Shop this bundle
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link
            to={ctaLink}
            prefetch="intent"
            className="inline-flex text-sm font-medium text-navy transition-colors hover:text-terracotta"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
