export const REVIEW_FIT_OPTIONS = [
  "True to size",
  "Slightly small",
  "Slightly big",
  "Too small",
  "Too big",
] as const;

export type SerializedReview = {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  photos: string[];
  sizePurchased: string | null;
  height: string | null;
  lengthPurchased: string | null;
  weight: string | null;
  occupation: string | null;
  fit: string | null;
  createdAt: string;
};

export function parseReviewPhotos(photos: unknown): string[] {
  if (!Array.isArray(photos)) return [];
  const ids: string[] = [];
  for (const photo of photos) {
    if (typeof photo === "string" && photo.trim()) {
      ids.push(photo.trim());
      continue;
    }
    if (photo && typeof photo === "object" && "publicId" in photo) {
      const publicId = (photo as { publicId?: unknown }).publicId;
      if (typeof publicId === "string" && publicId.trim()) {
        ids.push(publicId.trim());
      }
    }
  }
  return ids.slice(0, 4);
}

function optionalTrim(
  value: FormDataEntryValue | null | undefined,
  max: number
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Collapse mirrored set reviews (same author + body) into one card. */
export function dedupeReviews<T extends {
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
}>(reviews: T[]): T[] {
  const seen = new Set<string>();
  return reviews.filter((review) => {
    const key = `${review.customerName}\0${review.rating}\0${review.title ?? ""}\0${review.body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function serializeReview(review: {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  photos: unknown;
  sizePurchased?: string | null;
  height?: string | null;
  lengthPurchased?: string | null;
  weight?: string | null;
  occupation?: string | null;
  fit?: string | null;
  createdAt: Date;
}): SerializedReview {
  return {
    id: review.id,
    customerName: review.customerName,
    rating: review.rating,
    title: review.title,
    body: review.body,
    verifiedPurchase: review.verifiedPurchase,
    photos: parseReviewPhotos(review.photos),
    sizePurchased: review.sizePurchased ?? null,
    height: review.height ?? null,
    lengthPurchased: review.lengthPurchased ?? null,
    weight: review.weight ?? null,
    occupation: review.occupation ?? null,
    fit: review.fit ?? null,
    createdAt: review.createdAt.toISOString(),
  };
}

export type ReviewSubmission =
  | { ok: true; data: ReviewCreateData }
  | { ok: false; error: string; honeypot?: true };

export type ReviewCreateData = {
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  sizePurchased: string | null;
  height: string | null;
  lengthPurchased: string | null;
  weight: string | null;
  occupation: string | null;
  fit: string | null;
};

export function parseReviewSubmission(formData: FormData): ReviewSubmission {
  if (String(formData.get("website") ?? "").trim()) {
    return { ok: false, error: "", honeypot: true };
  }

  if (String(formData.get("intent") ?? "") !== "submit-review") {
    return { ok: false, error: "Invalid review action." };
  }

  const customerName = String(formData.get("customerName") ?? "").trim();
  const title = optionalTrim(formData.get("title"), 120);
  const body = String(formData.get("body") ?? "").trim();
  const rating = parseInt(String(formData.get("rating") ?? "0"), 10);

  if (customerName.length < 2 || customerName.length > 80) {
    return { ok: false, error: "Please enter your name." };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Please choose a rating from 1 to 5." };
  }
  if (body.length < 20 || body.length > 2000) {
    return { ok: false, error: "Write at least 20 characters about the product." };
  }

  return {
    ok: true,
    data: {
      customerName,
      rating,
      title,
      body,
      sizePurchased: optionalTrim(formData.get("sizePurchased"), 20),
      height: optionalTrim(formData.get("height"), 40),
      lengthPurchased: optionalTrim(formData.get("lengthPurchased"), 40),
      weight: optionalTrim(formData.get("weight"), 40),
      occupation: optionalTrim(formData.get("occupation"), 80),
      fit: optionalTrim(formData.get("fit"), 40),
    },
  };
}

export function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function averageRatingLabel(avg: number | null | undefined): string {
  if (avg == null || Number.isNaN(avg)) return "0.0";
  return avg.toFixed(1);
}
