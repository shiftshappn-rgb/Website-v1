import { createHash } from "node:crypto";
import type { DiscountType, PrismaClient } from "@prisma/client";
import {
  validateCartItemsInput,
  type SanitizedCartItem,
} from "~/lib/cart-validation";
import {
  computeDiscountAmount,
  resolveDiscountCode,
  resolveGiftCard,
} from "~/lib/commerce.server";
import { computeTaxAmount } from "~/lib/tax";
import { loadTaxRatePercent } from "~/lib/tax.server";
import { getVariantPrice } from "~/lib/utils";
import {
  MAX_GIFT_CARD_AMOUNT,
  MIN_GIFT_CARD_AMOUNT,
  parseMoney,
} from "~/lib/validation";

type Db = PrismaClient;

export const FREE_SHIPPING_THRESHOLD = 100;
export const STANDARD_SHIPPING_CAD = 9.95;
export const EXPRESS_SHIPPING_CAD = 15;

export type CheckoutQuoteLine = {
  kind: "product" | "gift_card";
  variantId: string | null;
  productId: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  price: number;
  setGroupId?: string;
  packGroupId?: string;
  recipientEmail?: string;
  giftNote?: string;
  giftAmount?: number;
};

export type ShippingInput = {
  deliveryLocationId?: string | null;
  deliveryLocationType?: string | null;
  deliveryTimeSlotId?: string | null;
  shippingMethod?: string | null;
  isGiftCardsOnly?: boolean;
};

export type CheckoutQuote = {
  lines: CheckoutQuoteLine[];
  subtotal: number;
  discountAmount: number;
  giftCardAmount: number;
  shippingCost: number;
  tax: number;
  total: number;
  taxRatePercent: number;
  currency: "CAD";
  promoCode?: string;
  giftCardCode?: string;
  discountType?: DiscountType;
  hasProducts: boolean;
  hasGiftCards: boolean;
  deliveryLocationId?: string;
  deliveryTimeSlotId?: string;
  shippingMethod: "hospital_free" | "standard" | "express";
  quoteHash: string;
  cartFingerprint: string;
};

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeShippingCost(input: {
  isGiftCardsOnly: boolean;
  isHospitalOrClinic: boolean;
  freeDelivery: boolean;
  shippingMethod: "hospital_free" | "standard" | "express";
  merchandiseSubtotal: number;
  freeShippingDiscount: boolean;
}): number {
  if (input.isGiftCardsOnly) return 0;
  if (input.isHospitalOrClinic || input.freeDelivery || input.shippingMethod === "hospital_free") {
    return 0;
  }
  if (input.freeShippingDiscount) return 0;
  if (input.shippingMethod === "express") return EXPRESS_SHIPPING_CAD;
  if (input.merchandiseSubtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return STANDARD_SHIPPING_CAD;
}

export async function repriceCart(
  db: Db,
  rawItems: unknown
): Promise<
  | { ok: true; lines: CheckoutQuoteLine[]; hasProducts: boolean; hasGiftCards: boolean }
  | { ok: false; error: string }
> {
  const validated = validateCartItemsInput(rawItems);
  if (!validated.ok) return validated;

  const items = validated.items;
  const requested = new Map<string, number>();
  for (const item of items) {
    if (item.kind === "gift_card") continue;
    requested.set(item.variantId, (requested.get(item.variantId) ?? 0) + item.quantity);
  }

  const lines: CheckoutQuoteLine[] = [];
  let hasGiftCards = false;
  let hasProducts = false;
  const buyingGiftCard = items.some((i) => i.kind === "gift_card");

  for (const item of items) {
    if (item.kind === "gift_card") {
      hasGiftCards = true;
      const amount = item.giftAmount ?? item.price;
      if (
        !Number.isFinite(amount) ||
        amount < MIN_GIFT_CARD_AMOUNT ||
        amount > MAX_GIFT_CARD_AMOUNT
      ) {
        return { ok: false, error: "Invalid gift card amount." };
      }
      lines.push({
        kind: "gift_card",
        variantId: null,
        productId: "gift-card",
        productName: item.productName || "ShiftsHappn e-gift card",
        variantLabel: item.variantLabel || `E-gift · $${amount}`,
        quantity: item.quantity,
        price: amount,
        giftAmount: amount,
        recipientEmail: item.recipientEmail,
        giftNote: item.giftNote,
      });
      continue;
    }

    hasProducts = true;
    const variant = await db.productVariant.findUnique({
      where: { id: item.variantId },
      include: { product: true },
    });

    const inSet =
      variant?.product.status === "archived"
        ? await db.bundleProduct.findFirst({
            where: { productId: variant.productId },
            select: { productId: true },
          })
        : null;

    if (!variant || (variant.product.status !== "active" && !inSet)) {
      return { ok: false, error: `Product unavailable: ${item.productName}` };
    }

    const needed = requested.get(variant.id) ?? item.quantity;
    if (variant.inventoryQty < needed) {
      return {
        ok: false,
        error: `Insufficient stock for ${item.productName} (${item.variantLabel})`,
      };
    }

    const isGrouped = Boolean(item.packGroupId || item.setGroupId);
    const catalogPrice = getVariantPrice(
      Number(variant.product.basePrice),
      variant.priceOverride != null ? Number(variant.priceOverride) : null
    );
    // Preserve allocated set/pack share when it is a finite non-negative client share
    // that does not exceed catalog (prevents inflating; under-share is intentional discount).
    const clientShare = parseMoney(item.price);
    const finalPrice =
      isGrouped && clientShare != null && clientShare >= 0 && clientShare <= catalogPrice
        ? clientShare
        : catalogPrice;

    lines.push({
      kind: "product",
      variantId: variant.id,
      productId: variant.productId,
      productName: isGrouped ? item.productName : variant.product.name,
      variantLabel: isGrouped
        ? item.variantLabel
        : `${variant.colorName} / ${variant.size}`,
      quantity: item.quantity,
      price: finalPrice,
      setGroupId: item.setGroupId,
      packGroupId: item.packGroupId,
    });
  }

  if (buyingGiftCard && items.some((i) => i.kind !== "gift_card" && false)) {
    // placeholder kept for clarity; GC-with-GC blocked below via gift redemption
  }

  return { ok: true, lines, hasProducts, hasGiftCards };
}

export async function resolveShipping(
  db: Db,
  input: ShippingInput,
  opts: {
    merchandiseSubtotal: number;
    freeShippingDiscount: boolean;
    isGiftCardsOnly: boolean;
  }
): Promise<
  | {
      ok: true;
      shippingCost: number;
      shippingMethod: "hospital_free" | "standard" | "express";
      deliveryLocationId?: string;
      deliveryTimeSlotId?: string;
      deliveryLocationType?: string;
      deliveryLocationName?: string;
      freeDelivery: boolean;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
> {
  if (opts.isGiftCardsOnly) {
    return {
      ok: true,
      shippingCost: 0,
      shippingMethod: "standard",
      freeDelivery: true,
    };
  }

  const locationId = (input.deliveryLocationId ?? "").trim();
  if (!locationId || locationId === "other-custom") {
    const method =
      input.shippingMethod === "express"
        ? "express"
        : ("standard" as const);
    const shippingCost = computeShippingCost({
      isGiftCardsOnly: false,
      isHospitalOrClinic: false,
      freeDelivery: false,
      shippingMethod: method,
      merchandiseSubtotal: opts.merchandiseSubtotal,
      freeShippingDiscount: opts.freeShippingDiscount,
    });
    return {
      ok: true,
      shippingCost,
      shippingMethod: method,
      deliveryLocationId: locationId || undefined,
      freeDelivery: false,
      deliveryLocationType: "other",
    };
  }

  const location = await db.deliveryLocation.findFirst({
    where: { id: locationId, isActive: true },
  });
  if (!location) {
    return {
      ok: false,
      error: "That delivery location is no longer available.",
      fieldErrors: { deliveryLocationId: "Choose a delivery location." },
    };
  }

  const isHospitalOrClinic =
    location.type === "hospital" || location.type === "clinic";
  let deliveryTimeSlotId: string | undefined;

  if (isHospitalOrClinic) {
    const slotId = (input.deliveryTimeSlotId ?? "").trim();
    if (!slotId) {
      return {
        ok: false,
        error: "Choose a delivery time slot.",
        fieldErrors: { deliveryTimeSlotId: "Choose a delivery time slot." },
      };
    }
    const slot = await db.deliveryTimeSlot.findFirst({
      where: {
        id: slotId,
        deliveryLocationId: location.id,
        isActive: true,
      },
    });
    if (!slot) {
      return {
        ok: false,
        error: "That time slot is no longer available.",
        fieldErrors: { deliveryTimeSlotId: "Choose a delivery time slot." },
      };
    }
    if (slot.maxOrders != null) {
      const used = await db.order.count({
        where: {
          deliveryTimeSlotId: slot.id,
          status: { notIn: ["cancelled", "refunded"] },
        },
      });
      if (used >= slot.maxOrders) {
        return {
          ok: false,
          error: "That time slot is fully booked.",
          fieldErrors: { deliveryTimeSlotId: "That time slot is fully booked." },
        };
      }
    }
    deliveryTimeSlotId = slot.id;
  }

  const shippingMethod: "hospital_free" | "standard" | "express" = isHospitalOrClinic
    ? "hospital_free"
    : input.shippingMethod === "express"
      ? "express"
      : "standard";

  const shippingCost = computeShippingCost({
    isGiftCardsOnly: false,
    isHospitalOrClinic,
    freeDelivery: location.freeDelivery,
    shippingMethod,
    merchandiseSubtotal: opts.merchandiseSubtotal,
    freeShippingDiscount: opts.freeShippingDiscount,
  });

  return {
    ok: true,
    shippingCost,
    shippingMethod,
    deliveryLocationId: location.id,
    deliveryTimeSlotId,
    deliveryLocationType: location.type,
    deliveryLocationName: location.name,
    freeDelivery: location.freeDelivery,
  };
}

function fingerprintCart(lines: CheckoutQuoteLine[]): string {
  const payload = lines
    .map(
      (l) =>
        `${l.kind}:${l.variantId ?? "gc"}:${l.quantity}:${l.price}:${l.packGroupId ?? ""}:${l.setGroupId ?? ""}`
    )
    .sort()
    .join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

function hashQuote(parts: Record<string, string | number | undefined>): string {
  const payload = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k] ?? ""}`)
    .join("&");
  return createHash("sha256").update(payload).digest("hex").slice(0, 40);
}

export async function buildCheckoutQuote(
  db: Db,
  input: {
    cartItems: unknown;
    promoCode?: string | null;
    giftCardCode?: string | null;
    phase2?: ShippingInput | null;
    email?: string | null;
  }
): Promise<{ ok: true; quote: CheckoutQuote } | { ok: false; error: string; fieldErrors?: Record<string, string> }> {
  const repriced = await repriceCart(db, input.cartItems);
  if (!repriced.ok) return repriced;

  const { lines, hasProducts, hasGiftCards } = repriced;
  const isGiftCardsOnly = hasGiftCards && !hasProducts;
  const subtotal = roundMoney(
    lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
  );

  const promoCode = (input.promoCode ?? "").trim().toUpperCase() || undefined;
  let discountAmount = 0;
  let discountType: DiscountType | undefined;
  let freeShippingDiscount = false;

  if (promoCode) {
    const resolved = await resolveDiscountCode(db, promoCode, subtotal);
    if ("error" in resolved) {
      const message = resolved.error || "That discount code is not valid.";
      return { ok: false, error: message, fieldErrors: { promoCode: message } };
    }
    discountType = resolved.discount.type;
    // Shipping not known yet for free_shipping amount; amount applied after shipping resolve.
    if (resolved.discount.type === "free_shipping") {
      freeShippingDiscount = true;
      discountAmount = 0;
    } else {
      discountAmount = computeDiscountAmount(
        resolved.discount.type,
        Number(resolved.discount.value),
        subtotal,
        0
      );
    }
  }

  const giftCardCode =
    (input.giftCardCode ?? "").trim().toUpperCase() || undefined;
  if (giftCardCode && isGiftCardsOnly) {
    return {
      ok: false,
      error: "Gift cards cannot be purchased with a gift card.",
      fieldErrors: { giftCardCode: "Gift cards cannot be purchased with a gift card." },
    };
  }

  const shippingInput = input.phase2 ?? {};
  const shippingResolved = await resolveShipping(db, shippingInput, {
    merchandiseSubtotal: Math.max(0, subtotal - discountAmount),
    freeShippingDiscount,
    isGiftCardsOnly,
  });
  if (!shippingResolved.ok) return shippingResolved;

  let shippingCost = shippingResolved.shippingCost;
  if (freeShippingDiscount) {
    discountAmount = shippingCost;
    shippingCost = 0;
  }

  let giftCardAmount = 0;
  if (giftCardCode && hasProducts) {
    const resolved = await resolveGiftCard(db, giftCardCode);
    if ("error" in resolved) {
      const message = resolved.error || "That gift card is not valid.";
      return { ok: false, error: message, fieldErrors: { giftCardCode: message } };
    }
    const merchandise = Math.max(0, subtotal - discountAmount);
    giftCardAmount = Math.min(
      Number(resolved.card.balance),
      merchandise + shippingCost
    );
    giftCardAmount = roundMoney(giftCardAmount);
  }

  const merchandise = Math.max(0, subtotal - discountAmount - giftCardAmount);
  const taxRatePercent = await loadTaxRatePercent(db);
  const tax = computeTaxAmount(merchandise + shippingCost, taxRatePercent);
  const total = roundMoney(Math.max(0, merchandise + shippingCost + tax));
  const cartFingerprint = fingerprintCart(lines);
  const quoteHash = hashQuote({
    cartFingerprint,
    subtotal,
    discountAmount,
    giftCardAmount,
    shippingCost,
    tax,
    total,
    promoCode,
    giftCardCode,
    email: (input.email ?? "").trim().toLowerCase(),
  });

  return {
    ok: true,
    quote: {
      lines,
      subtotal,
      discountAmount: roundMoney(discountAmount),
      giftCardAmount,
      shippingCost,
      tax,
      total,
      taxRatePercent,
      currency: "CAD",
      promoCode,
      giftCardCode,
      discountType,
      hasProducts,
      hasGiftCards,
      deliveryLocationId: shippingResolved.deliveryLocationId,
      deliveryTimeSlotId: shippingResolved.deliveryTimeSlotId,
      shippingMethod: shippingResolved.shippingMethod,
      quoteHash,
      cartFingerprint,
    },
  };
}

export async function redeemGiftCardAtomic(
  db: Db,
  code: string,
  amount: number
): Promise<boolean> {
  if (amount <= 0) return true;
  const card = await db.giftCard.findUnique({ where: { code } });
  if (!card || card.status !== "active") return false;
  const balance = Number(card.balance);
  if (balance < amount) return false;
  const updated = await db.giftCard.updateMany({
    where: {
      id: card.id,
      status: "active",
      balance: { gte: amount },
    },
    data: { balance: roundMoney(balance - amount) },
  });
  return updated.count === 1;
}

export async function incrementDiscountUsageAtomic(
  db: Db,
  code: string
): Promise<boolean> {
  const promo = await db.discountCode.findUnique({ where: { code } });
  if (!promo || !promo.isActive) return false;
  if (promo.usageLimit == null) {
    await db.discountCode.update({
      where: { id: promo.id },
      data: { usedCount: { increment: 1 } },
    });
    return true;
  }
  if (promo.usedCount >= promo.usageLimit) return false;
  const guarded = await db.discountCode.updateMany({
    where: {
      id: promo.id,
      usedCount: { lt: promo.usageLimit },
    },
    data: { usedCount: { increment: 1 } },
  });
  return guarded.count === 1;
}

export type { SanitizedCartItem };
