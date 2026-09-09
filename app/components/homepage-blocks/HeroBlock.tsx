import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { HERO_IMAGES } from "~/lib/hero-media";
import type { BlockCommonProps, HeroContent } from "./types";

type Audience = "women" | "men";

function HeroModel({
  src,
  alt,
  visible,
}: {
  src: string;
  alt: string;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="hero-model is-visible">
      <img src={src} alt="" className="hero-model-depth" />
      <img
        src={src}
        alt={alt}
        width={1024}
        height={576}
        fetchPriority="high"
        className="hero-model-photo"
      />
    </div>
  );
}

function SparkMarks() {
  return (
    <svg
      viewBox="0 0 72 56"
      className="hero-spark h-12 w-16 text-white lg:h-16 lg:w-20"
      fill="none"
      aria-hidden
    >
      <path
        d="M8 40c8-7 14-18 16-32"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M28 44c10-6 18-16 22-30"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M48 46c8-5 16-14 20-26"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HeroBlock({
  content,
}: BlockCommonProps & { content: HeroContent }) {
  const [audience, setAudience] = useState<Audience>("women");
  const shopLink = audience === "women" ? "/shop/women" : "/shop/men";

  return (
    <section className="bg-sand px-6 pt-6 pb-6 sm:px-10 sm:pt-8 sm:pb-8 lg:px-14 lg:pt-10 lg:pb-10">
      <div
        className={`hero-stage relative min-h-[calc(100svh-7.5rem)] overflow-hidden rounded-4xl transition-colors duration-700 sm:min-h-[calc(100svh-10rem)] sm:rounded-[2.5rem] lg:min-h-[calc(100svh-12rem)] lg:rounded-[3rem] ${
          audience === "women" ? "bg-sage" : "bg-navy"
        }`}
      >
        <h1 className="sr-only">{content.headline}</h1>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 pt-16 sm:pt-14 lg:pt-10">
          <p
            className={`hero-wordmark animate-enter-left text-center text-[22vw] lg:text-[18vw] ${
              audience === "men" ? "text-white/90" : "text-white"
            }`}
            aria-hidden
          >
            shift
            <span className="relative inline-block">
              s
              <span className="absolute -right-1 bottom-[0.18em] h-2.5 w-2.5 rounded-full bg-gold sm:h-3.5 sm:w-3.5 lg:right-1 lg:h-4 lg:w-4" />
            </span>
          </p>
        </div>

        <div className="animate-hero-media hero-models pointer-events-none absolute inset-x-0 -bottom-2 top-0 z-10 flex items-end justify-center sm:bottom-0">
          <div className="relative left-1/2 h-full w-[118%] -translate-x-1/2 lg:w-[124%]">
            <div className="absolute left-[4%] top-[6%] z-10 sm:left-[10%] sm:top-[10%]">
              <SparkMarks />
            </div>
            <div className="hero-model-floor" />
            <HeroModel
              src={HERO_IMAGES.women}
              alt="Women wearing shiftshappn scrubs"
              visible={audience === "women"}
            />
            <HeroModel
              src={HERO_IMAGES.men}
              alt="Men wearing shiftshappn scrubs"
              visible={audience === "men"}
            />
          </div>
        </div>

        <div className="absolute inset-x-8 bottom-8 z-20 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between lg:inset-x-12 lg:bottom-10">
          <Link
            to={shopLink}
            prefetch="intent"
            className="group inline-flex max-w-full items-center gap-3 rounded-full bg-white py-2 pl-5 pr-2 text-sm font-semibold text-charcoal shadow-sm transition-transform duration-300 hover:scale-[1.02] sm:text-base"
          >
            <span className="truncate">
              {audience === "women" ? "Shop women" : "Shop men"}
            </span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-charcoal transition-transform duration-300 group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <div
            className="flex w-fit items-center rounded-full bg-white p-1 shadow-sm"
            role="group"
            aria-label="Shop audience"
          >
            {(["women", "men"] as const).map((option) => {
              const selected = audience === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAudience(option)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                    selected
                      ? "bg-gold text-charcoal"
                      : "text-charcoal/55 hover:text-charcoal"
                  }`}
                  aria-pressed={selected}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
