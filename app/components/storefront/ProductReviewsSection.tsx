import { Link } from "react-router";
import {
  averageRatingLabel,
  type SerializedReview,
} from "~/lib/reviews";
import { ReviewCard } from "./ReviewCard";
import { ReviewForm } from "./ReviewForm";
import { StarRating } from "./StarRating";

export function ProductReviewsSection({
  productSlug,
  productName,
  reviews,
  avgRating,
  totalCount,
  previewLimit = 3,
  showAllLink = true,
  allReviewsHref,
  cloudName,
  reviewer,
  submitted,
  error,
}: {
  productSlug: string;
  productName: string;
  reviews: SerializedReview[];
  avgRating: number | null;
  totalCount: number;
  previewLimit?: number;
  showAllLink?: boolean;
  /** Override “see all” destination (defaults to product reviews page). */
  allReviewsHref?: string;
  cloudName?: string | null;
  reviewer: {
    name: string;
    isSignedIn: boolean;
    verifiedPurchase: boolean;
  };
  submitted?: boolean;
  error?: string;
}) {
  const visible = reviews.slice(0, previewLimit);
  const average = avgRating ?? 0;
  const seeAllHref = allReviewsHref ?? `/products/${productSlug}/reviews`;

  return (
    <section
      id="reviews"
      className="relative mt-20 scroll-mt-24 overflow-hidden border-t border-charcoal/10 pt-14"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,rgba(244,237,227,0.7),transparent_65%)]" />

      <div className="relative">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-navy/45">
              Reviews
            </p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight text-navy sm:text-4xl">
              The reviews are in
            </h2>
          </div>
          {showAllLink && totalCount > previewLimit ? (
            <Link
              to={seeAllHref}
              className="inline-flex min-h-11 items-center rounded-full border border-navy/15 bg-white px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-navy transition-colors hover:border-navy/30 hover:bg-sand/50"
            >
              See all reviews
            </Link>
          ) : null}
        </div>

        {totalCount > 0 ? (
          <div className="mt-8 flex flex-wrap items-center gap-6 rounded-2xl border border-charcoal/10 bg-white/90 px-5 py-5 shadow-[0_14px_36px_rgba(17,26,34,0.04)] sm:px-7">
            <div>
              <p className="font-serif text-4xl tracking-tight text-navy">
                {averageRatingLabel(average)}
                <span className="text-xl font-normal text-charcoal/35"> / 5</span>
              </p>
              <StarRating value={average} size={18} className="mt-2" />
            </div>
            <div className="h-12 w-px bg-charcoal/10 max-sm:hidden" aria-hidden />
            <p className="text-sm text-charcoal/55">
              Based on{" "}
              <span className="font-medium text-charcoal">
                {totalCount.toLocaleString("en-CA")}
              </span>{" "}
              review{totalCount === 1 ? "" : "s"} for {productName}
            </p>
          </div>
        ) : (
          <p className="mt-5 max-w-md text-sm leading-relaxed text-charcoal/55">
            Be the first to review {productName}. Your note helps the next shift find the right
            fit.
          </p>
        )}

        {visible.length > 0 ? (
          <div className="mt-8 space-y-4">
            {visible.map((review) => (
              <ReviewCard key={review.id} review={review} cloudName={cloudName} />
            ))}
          </div>
        ) : null}

        {showAllLink && totalCount > previewLimit ? (
          <div className="mt-6">
            <Link
              to={seeAllHref}
              className="text-sm font-medium text-navy underline-offset-4 transition-colors hover:text-terracotta hover:underline"
            >
              See all {totalCount} reviews
            </Link>
          </div>
        ) : null}

        <div id="write-review" className="mt-14 max-w-xl scroll-mt-24">
          <h3 className="font-serif text-2xl tracking-tight text-navy">Write a review</h3>
          <p className="mt-1.5 text-sm text-charcoal/55">
            Reviews appear after a quick approval — usually within a day.
          </p>
          <div className="mt-5">
            <ReviewForm
              defaultName={reviewer.name}
              isSignedIn={reviewer.isSignedIn}
              verifiedPurchase={reviewer.verifiedPurchase}
              submitted={submitted}
              error={error}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
