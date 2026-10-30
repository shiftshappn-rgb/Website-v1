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

  return (
    <section id="reviews" className="mt-20 scroll-mt-24 border-t border-charcoal/10 pt-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight text-charcoal sm:text-3xl">
          The Reviews Are In
        </h2>
        {showAllLink && totalCount > 0 && (
          <Link
            to={`/products/${productSlug}/reviews`}
            className="inline-flex h-11 items-center border border-charcoal px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-charcoal transition-colors hover:bg-charcoal hover:text-white"
          >
            See all reviews
          </Link>
        )}
      </div>

      {totalCount > 0 ? (
        <div className="mt-6">
          <p className="text-3xl font-semibold tracking-tight text-charcoal">
            {averageRatingLabel(average)}
            <span className="text-xl font-normal text-charcoal/45"> / 5</span>
          </p>
          <StarRating value={average} size={18} className="mt-2" />
          <p className="mt-2 text-[13px] text-charcoal/50">
            {`Based on ${totalCount.toLocaleString("en-CA")} review${totalCount === 1 ? "" : "s"}`}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-charcoal/55">
          Be the first to review {productName}.
        </p>
      )}

      {visible.length > 0 && (
        <div className="mt-8 space-y-4 border-t border-charcoal/10 pt-8">
          {visible.map((review) => (
            <ReviewCard key={review.id} review={review} cloudName={cloudName} />
          ))}
        </div>
      )}

      {showAllLink && totalCount > previewLimit && (
        <div className="mt-6">
          <Link
            to={`/products/${productSlug}/reviews`}
            className="text-sm font-medium text-navy underline underline-offset-4 hover:text-terracotta"
          >
            See all {totalCount} reviews
          </Link>
        </div>
      )}

      <div className="mt-12 max-w-xl">
        <h3 className="mb-4 text-lg font-medium text-charcoal">Write a review</h3>
        <ReviewForm
          defaultName={reviewer.name}
          isSignedIn={reviewer.isSignedIn}
          verifiedPurchase={reviewer.verifiedPurchase}
          submitted={submitted}
          error={error}
        />
      </div>
    </section>
  );
}
