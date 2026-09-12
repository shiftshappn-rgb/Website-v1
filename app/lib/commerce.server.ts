import type { DiscountType } from "@prisma/client";
import type { tryDb } from "~/db.server";

type Db = NonNullable<ReturnType<typeof tryDb>>;

export function generateGiftCardCode() {
  const chunk = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GC-${chunk()}-${chunk()}`;
}

export function computeDiscountAmount(
  type: DiscountType,
  value: number,
  subtotal: number,
  shipping: number
) {
  if (type === "percent") {
    return Math.min(subtotal, Math.round(subtotal * (value / 100) * 100) / 100);
  }
  if (type === "fixed") {
    return Math.min(subtotal, value);
  }
  return shipping;
}

export async function resolveDiscountCode(db: Db, code: string, subtotal: number) {
  const discount = await db.discountCode.findUnique({
    where: { code: code.trim().toUpperCase() },
  });
  if (!discount || !discount.isActive) {
    return { error: "That discount code is not valid." as const };
  }
  if (discount.expiresAt && discount.expiresAt < new Date()) {
    return { error: "That discount code has expired." as const };
  }
  if (discount.usageLimit != null && discount.usedCount >= discount.usageLimit) {
    return { error: "That discount code has been fully used." as const };
  }
  if (discount.minSpend && subtotal < Number(discount.minSpend)) {
    return {
      error: `Spend ${Number(discount.minSpend).toFixed(2)} CAD to use this code.` as const,
    };
  }
  return { discount };
}

export async function resolveGiftCard(db: Db, code: string) {
  const card = await db.giftCard.findUnique({
    where: { code: code.trim().toUpperCase() },
  });
  if (!card || card.status !== "active" || Number(card.balance) <= 0) {
    return { error: "That gift card is not valid." as const };
  }
  return { card };
}

export async function getActiveMonthlyOffer(db: Db) {
  const now = new Date();
  return db.monthlyOffer.findFirst({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { startsAt: "desc" },
  });
}
