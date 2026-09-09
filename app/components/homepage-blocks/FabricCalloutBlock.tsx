import { useScrollReveal } from "~/lib/use-scroll-reveal";
import { BlockImage } from "./BlockImage";
import type { BlockCommonProps, FabricCalloutContent } from "./types";

export function FabricCalloutBlock({
  content,
  cloudName,
}: BlockCommonProps & { content: FabricCalloutContent }) {
  const revealRef = useScrollReveal<HTMLElement>();
  const editorialText =
    content.subheadline ??
    (content.features.length > 0
      ? `${content.features.join(". ")}.`
      : content.headline);

  return (
    <section ref={revealRef} className="section-navy py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="animate-on-scroll from-left space-y-6">
            <p className="kicker text-gold">{content.headline}</p>

            <h2 className="text-3xl lg:text-4xl font-sans font-semibold text-white leading-snug">
              {editorialText}
            </h2>

            {content.specs.length > 0 && (
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/15 bg-white/10">
                {content.specs.map((spec) => {
                  const [label, ...rest] = spec.split(":");
                  const value = rest.join(":").trim();
                  return (
                    <div key={spec} className="bg-navy px-4 py-4">
                      <dt className="text-xs uppercase tracking-wider text-white/60">
                        {value ? label.trim() : spec}
                      </dt>
                      {value ? (
                        <dd className="mt-1 text-sm font-medium text-white">
                          {value}
                        </dd>
                      ) : null}
                    </div>
                  );
                })}
              </dl>
            )}
          </div>

          <BlockImage
            publicId={content.imagePublicId}
            alt={content.headline}
            width={700}
            cloudName={cloudName}
            className="animate-on-scroll from-right aspect-square w-full rounded-xl object-cover bg-charcoal border border-white/10"
            placeholderClassName="animate-on-scroll from-right aspect-square w-full rounded-xl bg-charcoal border border-white/10"
          />
        </div>
      </div>
    </section>
  );
}
