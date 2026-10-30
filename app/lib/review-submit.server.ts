import type { PrismaClient } from "@prisma/client";
import { parseReviewSubmission } from "~/lib/reviews";
import { getCustomer } from "~/lib/session.server";

export async function submitProductReview({
  db,
  request,
  productId,
}: {
  db: PrismaClient;
  request: Request;
  productId: string;
}): Promise<{ submitted?: true; error?: string }> {
  const formData = await request.formData();
  const parsed = parseReviewSubmission(formData);
  if (!parsed.ok) {
    if (parsed.honeypot) return { submitted: true };
    return { error: parsed.error };
  }

  const customer = await getCustomer(request);
  const verifiedPurchase = customer
    ? Boolean(
        await db.orderItem.findFirst({
          where: {
            productVariant: { productId },
            order: {
              status: { in: ["paid", "fulfilled"] },
              OR: [{ customerId: customer.id }, { email: customer.email }],
            },
          },
          select: { id: true },
        })
      )
    : false;

  const customerName =
    parsed.data.customerName || customer?.name?.trim() || parsed.data.customerName;

  await db.review.create({
    data: {
      productId,
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
      status: "pending",
    },
  });

  return { submitted: true };
}
