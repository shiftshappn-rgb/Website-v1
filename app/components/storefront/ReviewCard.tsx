import { formatReviewDate, type SerializedReview } from "~/lib/reviews";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { StarRating } from "./StarRating";

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 text-[12px] leading-snug">
      <dt className="text-charcoal/55">{label}</dt>
      <dd className="font-medium text-charcoal">{value}</dd>
    </div>
  );
}

export function ReviewCard({
  review,
  cloudName,
}: {
  review: SerializedReview;
  cloudName?: string | null;
}) {
  const meta: Array<{ label: string; value: string }> = [
    review.sizePurchased
      ? { label: "Size Purchased", value: review.sizePurchased }
      : null,
    review.height ? { label: "Height", value: review.height } : null,
    review.lengthPurchased
      ? { label: "Length Purchased", value: review.lengthPurchased }
      : null,
    review.weight ? { label: "Weight", value: review.weight } : null,
    review.occupation ? { label: "Occupation", value: review.occupation } : null,
    review.fit ? { label: "Fit", value: review.fit } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  return (
    <article className="border border-charcoal/10 bg-white p-5 sm:p-6">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_14rem] md:items-start lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <StarRating value={review.rating} size={14} />
            <time
              dateTime={review.createdAt}
              className="text-[12px] text-charcoal/45"
            >
              {formatReviewDate(review.createdAt)}
            </time>
          </div>
          {review.title && (
            <h3 className="mt-3 text-[15px] font-semibold text-charcoal">
              {review.title}
            </h3>
          )}
          <p className="mt-2 text-sm leading-6 text-charcoal/75">{review.body}</p>
          {review.verifiedPurchase && (
            <p className="mt-3 text-[12px] font-medium text-navy">
              Verified purchase
            </p>
          )}
          {review.photos.length > 0 && cloudName && (
            <div className="mt-4 flex flex-wrap gap-2">
              {review.photos.map((publicId) => {
                const src = cloudinaryImageUrl(publicId, cloudName, 240);
                if (!src) return null;
                return (
                  <img
                    key={publicId}
                    src={src}
                    alt=""
                    className="h-16 w-16 rounded object-cover"
                  />
                );
              })}
            </div>
          )}
        </div>

        <aside className="bg-[#f5f5f3] p-4">
          <p className="text-[13px] font-semibold text-charcoal">
            {review.customerName}
          </p>
          {meta.length > 0 ? (
            <dl className="mt-3 space-y-2">
              {meta.map((row) => (
                <MetaRow key={row.label} label={row.label} value={row.value} />
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-[12px] text-charcoal/50">Customer review</p>
          )}
        </aside>
      </div>
    </article>
  );
}
