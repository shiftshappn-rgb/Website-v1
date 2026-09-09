import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import type { BlockCommonProps, ReviewHighlightContent, ReviewItem } from "./types";

function normalizeReviews(content: ReviewHighlightContent): ReviewItem[] {
  if (content.reviews?.length) {
    return content.reviews;
  }
  if (content.quote && content.author) {
    return [
      {
        quote: content.quote,
        author: content.author,
        rating: content.rating,
        verified: content.verified ?? true,
      },
    ];
  }
  return [];
}

export function ReviewHighlightBlock({
  content,
}: BlockCommonProps & { content: ReviewHighlightContent }) {
  const reviews = normalizeReviews(content);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const revealRef = useScrollReveal<HTMLElement>();

  useEffect(() => {
    if (reviews.length <= 1 || paused) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % reviews.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [reviews.length, paused]);

  if (reviews.length === 0) return null;

  const active = reviews[activeIndex] ?? reviews[0];
  const rating = active.rating ?? 5;

  function goTo(index: number) {
    setActiveIndex((index + reviews.length) % reviews.length);
  }

  return (
    <section
      ref={revealRef}
      className="section-white py-12 lg:py-16"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="animate-on-scroll from-scale">
          <div
            className="flex justify-center gap-1 mb-8"
            aria-label={`${rating} out of 5 stars`}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < rating ? "fill-terracotta text-terracotta" : "text-charcoal/20"
                }`}
                strokeWidth={1.5}
              />
            ))}
          </div>

          <div className="relative min-h-40">
            {reviews.map((review, i) => {
              const isActive = i === activeIndex;
              return (
                <blockquote
                  key={`${review.author}-${i}`}
                  className={`text-2xl sm:text-3xl lg:text-4xl font-serif italic text-navy leading-snug tracking-tight transition-opacity duration-500 ${
                    isActive
                      ? "relative opacity-100"
                      : "pointer-events-none absolute inset-0 opacity-0"
                  }`}
                  aria-hidden={!isActive}
                >
                  &ldquo;{review.quote}&rdquo;
                </blockquote>
              );
            })}
          </div>

          <p className="mt-8 text-sm text-charcoal/60">
            {active.author}
            {active.verified !== false ? (
              <>
                <span className="mx-2">·</span>
                <span>verified buyer</span>
              </>
            ) : null}
          </p>
        </div>

        {reviews.length > 1 ? (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label="Previous review"
              onClick={() => goTo(activeIndex - 1)}
              className="rounded-full border border-charcoal/15 p-2 text-charcoal/70 transition-colors hover:border-navy hover:text-navy"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex justify-center gap-2" role="tablist" aria-label="Reviews">
              {reviews.map((_, i) => {
                const isActive = i === activeIndex;
                return (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Review ${i + 1}`}
                    onClick={() => goTo(i)}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      isActive ? "bg-navy" : "bg-charcoal/20 hover:bg-charcoal/40"
                    }`}
                  />
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Next review"
              onClick={() => goTo(activeIndex + 1)}
              className="rounded-full border border-charcoal/15 p-2 text-charcoal/70 transition-colors hover:border-navy hover:text-navy"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
