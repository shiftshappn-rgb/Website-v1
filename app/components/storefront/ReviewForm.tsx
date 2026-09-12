import { useState } from "react";
import { Form, Link } from "react-router";
import { Star } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { Input, Textarea } from "~/components/ui/Input";
import { cn } from "~/lib/utils";

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
                    value <= rating ? "fill-terracotta text-terracotta" : "text-charcoal/20"
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

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">Submit review</Button>
        {isSignedIn && verifiedPurchase && (
          <p className="text-xs text-charcoal/55">This will publish as a verified purchase.</p>
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
