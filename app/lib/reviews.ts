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

export function serializeReview(review: {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  photos: unknown;
  createdAt: Date;
}) {
  return {
    id: review.id,
    customerName: review.customerName,
    rating: review.rating,
    title: review.title,
    body: review.body,
    verifiedPurchase: review.verifiedPurchase,
    photos: parseReviewPhotos(review.photos),
    createdAt: review.createdAt.toISOString(),
  };
}
