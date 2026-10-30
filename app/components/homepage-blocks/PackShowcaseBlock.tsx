import { Link } from "react-router";
import { BundleGrid } from "~/components/storefront/BundleCard";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
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

  const bundles = packs.map((pack) => ({
    id: pack.id,
    name: pack.name,
    href: pack.href,
    basePrice: pack.basePrice,
    compareAtPrice: pack.compareAtPrice ?? null,
    pieceImages: pack.pieceImages?.length
      ? pack.pieceImages
      : (pack.images ?? [])
          .slice(0, 4)
          .map((image) => ({ publicId: image.publicId, alt: image.alt })),
  }));

  return (
    <section ref={revealRef} className="section-white py-12 lg:py-16">
      <div className="mx-auto w-full max-w-350 px-4 sm:px-6 lg:px-10">
        <div className="mb-8 flex items-end justify-between gap-4 lg:mb-10">
          <div className="animate-on-scroll space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-charcoal lg:text-2xl">
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

        <div className="animate-on-scroll">
          <BundleGrid bundles={bundles} cloudName={cloudName} />
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
