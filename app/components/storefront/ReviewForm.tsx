import { useState } from "react";
import { Form, Link } from "react-router";
import { Star } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { Input, Textarea } from "~/components/ui/Input";
import { CATALOG_LENGTHS, CATALOG_SIZES } from "~/lib/product-catalog";
import { REVIEW_FIT_OPTIONS } from "~/lib/reviews";
import { cn } from "~/lib/utils";

const fieldClass =
  "h-11 w-full border border-charcoal/15 bg-white px-3 text-sm text-charcoal outline-none focus:border-navy";

export function ReviewForm({
  defaultName,
  isSignedIn,
  verifiedPurchase,
  submitted,
  error,
}: {
  defaultName: string;
  isSignedIn: boolean;
  verifiedPurchase?: boolean;
  submitted?: boolean;
  error?: string;
}) {
  const [rating, setRating] = useState(5);

  if (submitted) {
    return (
      <div className="rounded-xl border border-navy/15 bg-white p-6" role="status">
        <p className="font-medium text-navy">Thanks — your review is in.</p>
        <p className="mt-2 text-sm text-charcoal/70">
          It will show on this page after we approve it.
        </p>
      </div>
    );
  }

  return (
    <Form method="post" className="space-y-4 rounded-xl border border-charcoal/10 bg-white p-6">
      <input type="hidden" name="intent" value="submit-review" />
      <input type="hidden" name="rating" value={rating} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />

      <div>
        <p className="mb-2 text-sm font-medium text-charcoal">Your rating</p>
        <div className="flex gap-1" role="group" aria-label="Star rating">
          {Array.from({ length: 5 }).map((_, index) => {
            const value = index + 1;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className="flex h-11 w-11 items-center justify-center"
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                aria-pressed={rating === value}
              >
                <Star
                  size={22}
                  className={cn(
                    value <= rating
                      ? "fill-charcoal text-charcoal"
                      : "text-charcoal/20"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <Input
        label="Name"
        name="customerName"
        defaultValue={defaultName}
        required
        maxLength={80}
      />
      <Input label="Title" name="title" maxLength={120} placeholder="How was the fit?" />
      <Textarea
        label="Review"
        name="body"
        required
        minLength={20}
        maxLength={2000}
        rows={4}
        className="min-h-24"
        placeholder="Share how it fits, feels, and holds up on shift."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-charcoal">Size purchased</span>
          <select name="sizePurchased" className={fieldClass} defaultValue="">
            <option value="">Select size</option>
            {CATALOG_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-charcoal">Length purchased</span>
          <select name="lengthPurchased" className={fieldClass} defaultValue="">
            <option value="">Select length</option>
            {CATALOG_LENGTHS.map((length) => (
              <option key={length} value={length}>
                {length}
              </option>
            ))}
          </select>
        </label>
        <Input label="Height" name="height" maxLength={40} placeholder="170–175 cm" />
        <Input label="Weight" name="weight" maxLength={40} placeholder="145 lb" />
        <Input
          label="Occupation"
          name="occupation"
          maxLength={80}
          placeholder="RN, Physician…"
        />
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-charcoal">Fit</span>
          <select name="fit" className={fieldClass} defaultValue="">
            <option value="">How did it fit?</option>
            {REVIEW_FIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">Submit review</Button>
        {isSignedIn && verifiedPurchase && (
          <p className="text-xs text-charcoal/55">
            This will publish as a verified purchase.
          </p>
        )}
        {!isSignedIn && (
          <p className="text-xs text-charcoal/55">
            <Link to="/auth/login" className="font-medium text-navy hover:text-terracotta">
              Sign in
            </Link>{" "}
            if you bought this — we can mark it as a verified purchase.
          </p>
        )}
      </div>
    </Form>
  );
}
