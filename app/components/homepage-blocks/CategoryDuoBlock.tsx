import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import type { BlockCommonProps, CategoryDuoContent } from "./types";

const WOMEN_IMAGE = "/images/shop-women.jpg?v=fullcard";
const MEN_IMAGE = "/images/shop-men.jpg?v=fullcard";

export function CategoryDuoBlock({
  content,
}: BlockCommonProps & { content: CategoryDuoContent }) {
  const revealRef = useScrollReveal<HTMLElement>();

  const headline = content.headline?.trim() || "Shop the fit";
  const body =
    content.body?.trim() ||
    "Scrubs shaped by real shifts — soft stretch, serious pockets, and a fabric that keeps up when the day runs long.";

  const imageCards = [
    {
      key: "women",
      label: content.womenLabel,
      subline: content.womenSubline?.trim() || "Built for her longest days.",
      link: content.womenLink,
      imageSrc: WOMEN_IMAGE,
      bgColor: content.womenBgColor ?? "#6B2D3C",
      direction: "from-left",
    },
    {
      key: "men",
      label: content.menLabel,
      subline: content.menSubline?.trim() || "Clean lines. Full range of motion.",
      link: content.menLink,
      imageSrc: MEN_IMAGE,
      bgColor: content.menBgColor ?? "#2B5A8A",
      direction: "from-right",
    },
  ];

  const featureHeadline =
    content.featureHeadline?.trim() || "Meet ShiftKnit";
  const featureBody =
    content.featureBody?.trim() ||
    "Our signature fabric: 4-way stretch, antimicrobial, and moisture-wicking — dry before your next patient.";
  const featureCtaLabel =
    content.featureCtaLabel?.trim() || "Explore fabric";
  const featureCtaLink = content.featureCtaLink?.trim() || "/shiftknit";

  return (
    <section ref={revealRef} className="section-sand py-10 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:mb-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <h2 className="max-w-md font-serif text-3xl leading-tight text-charcoal sm:text-4xl lg:text-[2.75rem]">
            {headline}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-charcoal/65 lg:pb-1 lg:text-right">
            {body}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {imageCards.map((card) => (
            <Link
              key={card.key}
              to={card.link}
              className={`group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[1.5rem] animate-on-scroll ${card.direction}`}
              style={{ backgroundColor: card.bgColor }}
            >
              <img
                src={card.imageSrc}
                alt={card.label}
                width={819}
                height={1024}
                decoding="async"
                fetchPriority="low"
                className="absolute inset-0 z-0 h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
              />

              <span
                aria-hidden
                className="absolute right-4 top-4 z-20 inline-flex size-10 items-center justify-center rounded-full bg-gold text-charcoal shadow-sm transition-transform duration-300 group-hover:scale-105 sm:right-5 sm:top-5 sm:size-11"
              >
                <ArrowUpRight className="size-5" />
              </span>

              <div className="relative z-10 px-5 pb-6 pt-16 sm:px-6 sm:pb-7">
                <h3 className="font-serif text-xl leading-snug text-white [text-shadow:0_1px_12px_rgba(17,26,34,0.35)] sm:text-2xl">
                  {card.label}
                </h3>
                <p className="mt-1.5 text-sm text-white/80">{card.subline}</p>
              </div>
            </Link>
          ))}

          <article className="group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[1.5rem] bg-charcoal p-6 text-white animate-on-scroll from-right sm:p-7 lg:p-8">
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">
                The fabric
              </p>
              <h3 className="font-serif text-2xl leading-snug text-white sm:text-3xl">
                {featureHeadline}
              </h3>
              <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-white/65">
                {featureBody}
              </p>
            </div>

            <Link
              to={featureCtaLink}
              className="mt-8 inline-flex w-full items-center justify-between gap-3 rounded-full bg-cream py-2 pl-5 pr-2 text-sm font-semibold text-charcoal transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:mt-10"
            >
              <span>{featureCtaLabel}</span>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gold text-charcoal">
                <ArrowUpRight className="size-4" aria-hidden />
              </span>
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
