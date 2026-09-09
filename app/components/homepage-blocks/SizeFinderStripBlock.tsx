import { Link } from "react-router";
import { Ruler } from "lucide-react";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import type { BlockCommonProps, SizeFinderStripContent } from "./types";

export function SizeFinderStripBlock({
  content,
}: BlockCommonProps & { content: SizeFinderStripContent }) {
  const revealRef = useScrollReveal<HTMLElement>();

  return (
    <section ref={revealRef} className="section-sand">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="animate-on-scroll flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-charcoal">
            <Ruler className="h-5 w-5 text-navy shrink-0" strokeWidth={1.5} />
            <p className="text-sm sm:text-base">{content.text}</p>
          </div>
          <Link
            to={content.ctaLink}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-terracotta px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-terracotta/90"
          >
            {content.ctaLabel}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
