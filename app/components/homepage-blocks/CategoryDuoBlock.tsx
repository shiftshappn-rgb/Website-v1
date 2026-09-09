import { Link } from "react-router";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import { BlockImage } from "./BlockImage";
import type { BlockCommonProps, CategoryDuoContent } from "./types";

export function CategoryDuoBlock({
  content,
  cloudName,
}: BlockCommonProps & { content: CategoryDuoContent }) {
  const revealRef = useScrollReveal<HTMLElement>();
  const cards = [
    {
      label: content.womenLabel,
      link: content.womenLink,
      imagePublicId: content.womenImagePublicId,
      bgColor: content.womenBgColor ?? "#8FA68E",
      direction: "from-left",
    },
    {
      label: content.menLabel,
      link: content.menLink,
      imagePublicId: content.menImagePublicId,
      bgColor: content.menBgColor ?? "#5CA8D6",
      direction: "from-right",
    },
  ];

  return (
    <section ref={revealRef} className="section-sand py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 gap-4 lg:gap-6">
          {cards.map((card) => (
            <Link
              key={card.link}
              to={card.link}
              className={`group relative overflow-hidden rounded-xl aspect-3/2 sm:aspect-5/4 animate-on-scroll ${card.direction}`}
              style={
                !card.imagePublicId ? { backgroundColor: card.bgColor } : undefined
              }
            >
              {card.imagePublicId ? (
                <BlockImage
                  publicId={card.imagePublicId}
                  alt={card.label}
                  width={700}
                  cloudName={cloudName}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.08]"
                  placeholderClassName="absolute inset-0 h-full w-full bg-stone"
                />
              ) : null}
              <div className="absolute inset-0 bg-linear-to-t from-charcoal/60 via-charcoal/15 to-transparent transition-colors duration-500 group-hover:from-charcoal/75" />
              <div className="absolute inset-x-0 bottom-0 p-6 lg:p-8 transition-transform duration-500 group-hover:-translate-y-1">
                <span className="inline-flex items-center gap-2 text-lg lg:text-xl font-serif text-white [text-shadow:0_1px_8px_rgba(17,26,34,0.35)] group-hover:gap-3 transition-all">
                  <span className="relative after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-white after:transition-transform after:duration-300 group-hover:after:scale-x-100">
                    {card.label}
                  </span>
                  <span className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
