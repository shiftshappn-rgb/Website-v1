import { Link } from "react-router";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import type { BlockCommonProps, BundleBannerContent } from "./types";

export function BundleBannerBlock({
  content,
}: BlockCommonProps & { content: BundleBannerContent }) {
  const revealRef = useScrollReveal<HTMLElement>();

  return (
    <section ref={revealRef} className="bg-sage py-8 lg:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="animate-on-scroll from-left space-y-2">
            {content.badge && (
              <p className="kicker text-charcoal/70">{content.badge}</p>
            )}
            <h2 className="text-xl lg:text-2xl font-sans font-semibold text-charcoal">
              {content.headline}
            </h2>
            {content.body && (
              <p className="text-charcoal/75 leading-relaxed text-sm sm:text-base">
                {content.body}
              </p>
            )}
          </div>
          <div className="animate-on-scroll from-right shrink-0">
            <Link
              to={content.ctaLink}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-charcoal px-6 py-2.5 text-sm font-medium text-white transition-transform duration-300 hover:scale-105 hover:bg-charcoal/90"
            >
              {content.ctaLabel}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
