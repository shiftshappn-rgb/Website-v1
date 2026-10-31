import type { PrismaClient } from "@prisma/client";
import { parseReviewSubmission } from "~/lib/reviews";
import { getCustomer } from "~/lib/session.server";
import { customerHasVerifiedPurchase } from "~/lib/verified-purchase.server";

export async function submitProductReview({
  db,
  request,
  productId,
  verifiedAgainstProductIds,
  mirrorToProductIds,
}: {
  db: PrismaClient;
  request: Request;
  productId: string;
  /** Product IDs that count toward verified purchase (e.g. set pieces). */
  verifiedAgainstProductIds?: string[];
  /**
   * Also create the same review on these products (e.g. set top + pants),
   * so each piece page owns a copy without relying on sibling lookups alone.
   */
  mirrorToProductIds?: string[];
}): Promise<{ submitted?: true; error?: string }> {
  const formData = await request.formData();
  const parsed = parseReviewSubmission(formData);
  if (!parsed.ok) {
    if (parsed.honeypot) return { submitted: true };
    return { error: parsed.error };
  }

  const customer = await getCustomer(request);
  const purchaseProductIds = [
    ...new Set([productId, ...(verifiedAgainstProductIds ?? [])]),
  ];
  const verifiedPurchase = customer
    ? await customerHasVerifiedPurchase(db, customer.id, purchaseProductIds)
    : false;

  const customerName =
    parsed.data.customerName || customer?.name?.trim() || parsed.data.customerName;

  const targetProductIds = [
    ...new Set([productId, ...(mirrorToProductIds ?? [])]),
  ];

  const reviewData = {
    customerName,
    rating: parsed.data.rating,
    title: parsed.data.title,
    body: parsed.data.body,
    sizePurchased: parsed.data.sizePurchased,
    height: parsed.data.height,
    lengthPurchased: parsed.data.lengthPurchased,
    weight: parsed.data.weight,
    occupation: parsed.data.occupation,
    fit: parsed.data.fit,
    verifiedPurchase,
    status: "pending" as const,
  };

  await db.$transaction(
    targetProductIds.map((id) =>
      db.review.create({
        data: {
          productId: id,
          ...reviewData,
        },
      })
    )
  );

  return { submitted: true };
}
