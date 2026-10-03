import { Link } from "react-router";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import { GiftCardFan } from "~/components/storefront/GiftCardFan";
import { formatCurrency } from "~/lib/utils";
import type { BlockCommonProps, GiftCardBannerContent } from "./types";

export function GiftCardBannerBlock({
  content,
}: BlockCommonProps & { content: GiftCardBannerContent }) {
  const revealRef = useScrollReveal<HTMLElement>();
  const fanAmounts =
    content.amounts && content.amounts.length > 0
      ? content.amounts
      : [50, 75, 100, 150, 200];

  return (
    <section ref={revealRef} className="bg-sand px-4 py-8 sm:px-10 lg:px-14 lg:py-10">
      <div className="mx-auto grid max-w-[1800px] gap-8 overflow-hidden rounded-[1.75rem] bg-sky/10 p-6 sm:grid-cols-[0.9fr_1.1fr] sm:p-8 lg:rounded-[2.25rem] lg:p-10">
        <div className="animate-on-scroll from-left max-w-md">
          {content.badge && (
            <p className="kicker text-navy/70">{content.badge}</p>
          )}
          <h2 className="mt-2 font-serif text-3xl text-navy lg:text-4xl">
            {content.headline}
          </h2>
          {content.body && (
            <p className="mt-3 text-sm leading-relaxed text-charcoal/75 sm:text-base">
              {content.body}
            </p>
          )}

          {content.amounts && content.amounts.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {content.amounts.map((amount) => (
                <span
                  key={amount}
                  className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-navy"
                >
                  {formatCurrency(amount)}
                </span>
              ))}
            </div>
          )}

          <Link
            to={content.ctaLink}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
          >
            {content.ctaLabel}
          </Link>
        </div>

        <div className="animate-on-scroll from-right mx-auto w-full max-w-xl sm:max-w-none">
          <GiftCardFan amounts={fanAmounts} linkBase={content.ctaLink} />
        </div>
      </div>
    </section>
  );
}
