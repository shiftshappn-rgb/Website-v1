import { useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { HERO_COPY, HERO_IMAGES } from "~/lib/hero-media";
import { HeroEcgLine } from "./HeroEcgLine";
import type { BlockCommonProps, HeroContent } from "./types";

type Audience = "women" | "men";

const AUDIENCES: Audience[] = ["women", "men"];
const SHIFTS = "SHIFTS".split("");
const HAPPN = "HAPPN".split("");

function WordmarkLetters({
  letters,
  className,
  startIndex,
}: {
  letters: string[];
  className: string;
  startIndex: number;
}) {
  return (
    <span className={className} aria-hidden>
      {letters.map((letter, index) => (
        <span
          key={`${letter}-${startIndex + index}`}
          className="hero-letter"
          style={
            {
              "--letter-index": startIndex + index,
            } as CSSProperties
          }
        >
          {letter}
        </span>
      ))}
    </span>
  );
}

export function HeroBlock({
  content,
}: BlockCommonProps & { content: HeroContent }) {
  const [audience, setAudience] = useState<Audience>("women");
  const model = HERO_COPY[audience];
  const images = HERO_IMAGES[audience];
  const eyebrow =
    content.badge?.trim() ||
    content.subheadline?.trim() ||
    "New season · Scrubs that keep up";

  return (
    <section
      aria-labelledby="hero-heading"
      className="bg-sand px-3 pt-3 pb-4 sm:px-5 sm:pt-5 sm:pb-8 lg:px-10 lg:pt-6 lg:pb-10"
    >
      <div
        className={`hero-stage relative isolate mx-auto h-[clamp(34rem,82svh,51.25rem)] w-full max-w-[1800px] overflow-hidden rounded-[1.75rem] transition-colors duration-700 sm:rounded-[2.25rem] ${
          audience === "women" ? "bg-sky" : "bg-navy"
        }`}
      >
        {/* Animated sequence remounts on audience change */}
        <div key={audience} className="pointer-events-none absolute inset-0">
          <div className="hero-wordmark-slot absolute inset-y-0 left-0 z-25 flex w-[min(58%,36rem)] items-center px-5 sm:w-[min(52%,42rem)] sm:px-10 lg:px-14">
            <h1
              id="hero-heading"
              className="hero-wordmark hero-wordmark--lift text-left text-[clamp(2.85rem,9.5vw,7.75rem)]"
            >
              <span className="sr-only">Shifts Happn</span>
              <WordmarkLetters
                letters={SHIFTS}
                className={`hero-wordmark-line block ${
                  audience === "men" ? "text-white/45" : "text-white/40"
                }`}
                startIndex={0}
              />
              <WordmarkLetters
                letters={HAPPN}
                className="hero-wordmark-line hero-wordmark-line--gold block text-gold/80"
                startIndex={SHIFTS.length}
              />
            </h1>
            <p className="sr-only">{content.headline}</p>
          </div>

          <div className="hero-ecg-slot absolute inset-x-0 z-20 text-white/90">
            <HeroEcgLine className="hero-ecg" />
          </div>

          {images.length > 0 ? (
            <div className="hero-models-slot pointer-events-none absolute inset-y-0 right-0 z-30 w-[min(72%,46rem)] overflow-hidden sm:w-[min(62%,52rem)]">
              <div className="hero-model-floor hero-model-floor--right" />
              <div className="hero-model-shell hero-model-shell--right absolute inset-0">
                {images.map((src, index) => (
                  <img
                    key={src}
                    src={src}
                    alt={index === 0 ? model.alt : ""}
                    width={682}
                    height={1024}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    decoding="async"
                    className={`hero-model ${
                      index === 0 ? "hero-model--front" : "hero-model--back"
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Soft bottom wash so CTAs stay readable */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-35 h-44 bg-linear-to-t from-charcoal/40 via-charcoal/15 to-transparent sm:h-48"
          aria-hidden
        />

        {/* Foreground controls — unchanged */}
        <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col justify-end p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-10 lg:p-14">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
            <div className="max-w-xl">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/85 sm:mb-4 sm:text-xs sm:tracking-[0.34em]">
                {eyebrow}
              </p>
              <Link
                to={model.href}
                prefetch="intent"
                className="group inline-flex h-12 items-center gap-3 rounded-full bg-white/95 py-1.5 pl-5 pr-1.5 text-charcoal shadow-[0_14px_36px_-14px_rgba(15,23,36,0.55)] backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none sm:h-auto sm:gap-4 sm:py-2 sm:pl-7 sm:pr-2"
              >
                <span className="text-[15px] font-semibold tracking-[-0.01em] sm:text-[17px]">
                  {model.cta}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-charcoal sm:h-11 sm:w-11">
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 sm:h-5 sm:w-5" />
                </span>
              </Link>
            </div>

            <div
              role="tablist"
              aria-label="Shop by fit"
              className="flex h-11 w-fit items-center rounded-full bg-white/95 p-1 shadow-[0_14px_36px_-14px_rgba(15,23,36,0.55)] backdrop-blur-sm sm:h-auto sm:p-1.5"
            >
              {AUDIENCES.map((option) => {
                const active = option === audience;
                return (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setAudience(option)}
                    className={`h-full rounded-full px-4 text-[11px] font-bold uppercase tracking-[0.16em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:min-h-11 sm:px-7 sm:py-3 sm:text-[13px] ${
                      active
                        ? "bg-gold text-charcoal"
                        : "text-charcoal/50 hover:text-charcoal"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
