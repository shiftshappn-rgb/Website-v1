import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { HERO_COPY, HERO_IMAGES } from "~/lib/hero-media";
import { ChromaKeyFilter } from "./ChromaKeyFilter";
import type { BlockCommonProps, HeroContent } from "./types";

type Audience = "women" | "men";

const AUDIENCES: Audience[] = ["women", "men"];

export function HeroBlock({
  content,
}: BlockCommonProps & { content: HeroContent }) {
  const [audience, setAudience] = useState<Audience>("women");
  const model = HERO_COPY[audience];
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
        {/* Poster wordmark — brand first, behind the cut-outs */}
        <div className="pointer-events-none absolute inset-0 z-10 flex select-none items-center justify-center px-4">
          <h1
            id="hero-heading"
            className="hero-wordmark animate-enter-left translate-y-[2%] text-center text-[clamp(4.25rem,17vw,13.5rem)]"
          >
            <span
              className={`block ${
                audience === "men" ? "text-white/28" : "text-white/34"
              }`}
            >
              Shifts
            </span>
            <span className="mt-[-0.24em] block text-gold/80">Happn</span>
          </h1>
          <p className="sr-only">{content.headline}</p>
        </div>

        <ChromaKeyFilter />

        {/* Models as cut-outs in front of the poster — centered for focus */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[6%] z-30 overflow-hidden sm:inset-y-0">
          <div className="hero-model-floor" />
          {AUDIENCES.map((option) => {
            const visible = audience === option;
            return (
              <div
                key={option}
                className={`hero-chroma-shell absolute inset-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity ${
                  visible
                    ? "translate-x-0 opacity-100"
                    : "pointer-events-none translate-x-4 opacity-0"
                }`}
              >
                <img
                  src={HERO_IMAGES[option]}
                  alt={visible ? HERO_COPY[option].alt : ""}
                  width={900}
                  height={1200}
                  fetchPriority={option === "women" ? "high" : "low"}
                  decoding="async"
                  aria-hidden={!visible}
                  className="hero-chroma-model"
                />
              </div>
            );
          })}
        </div>

        {/* Soft bottom wash so CTAs stay readable */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-35 h-44 bg-linear-to-t from-charcoal/40 via-charcoal/15 to-transparent sm:h-48"
          aria-hidden
        />

        {/* Foreground controls */}
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
