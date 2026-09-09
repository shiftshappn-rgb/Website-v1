import { Link } from "react-router";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import { BlockImage } from "./BlockImage";
import type { BlockCommonProps, BrandStoryContent } from "./types";

export function BrandStoryBlock({
  content,
  cloudName,
}: BlockCommonProps & { content: BrandStoryContent }) {
  const revealRef = useScrollReveal<HTMLElement>();

  return (
    <section ref={revealRef} className="section-sand py-12 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="animate-on-scroll space-y-6">
            {content.badge && <p className="kicker">{content.badge}</p>}
            <h2 className="text-4xl lg:text-5xl font-serif italic text-navy leading-snug tracking-tight">
              {content.headline}
            </h2>
            {content.body && (
              <p className="text-base text-charcoal/80 leading-relaxed max-w-lg">
                {content.body}
              </p>
            )}
            <Link
              to={content.ctaLink}
              className="inline-flex items-center gap-2 text-sm font-medium text-navy hover:text-terracotta transition-colors group"
            >
              {content.ctaLabel}
              <span className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>

          <BlockImage
            publicId={content.imagePublicId}
            alt={content.headline}
            width={700}
            cloudName={cloudName}
            className="animate-on-scroll aspect-4/3 w-full rounded-xl object-cover bg-stone"
            placeholderClassName="animate-on-scroll aspect-4/3 w-full rounded-xl bg-stone"
          />
        </div>
      </div>
    </section>
  );
}
