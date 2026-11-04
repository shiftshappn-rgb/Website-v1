import { randomInt } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { runWithDbTransaction } from "~/db.server";
import { sendOrderConfirmationEmail } from "~/lib/email.server";
import { resolveReviewTargetsFromOrder } from "~/lib/review-targets.server";
import { groupOrderLines } from "~/lib/order-line-groups";
import { formatCurrency } from "~/lib/utils";

function generateDeliveryCode(): string {
  return String(randomInt(100000, 1000000));
}

type Db = PrismaClient;

export type PaidOrderLine = {
  kind: "product" | "gift_card";
  variantId?: string | null;
  quantity: number;
  price: number;
  productName: string;
  variantLabel: string;
};

export type RecordPaidOrderInput = {
  orderNumber: string;
  email: string;
  customerId?: string | null;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency?: string;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  shippingAddress: Prisma.InputJsonValue;
  billingAddress?: Prisma.InputJsonValue | null;
  deliveryLocationId?: string | null;
  deliveryTimeSlotId?: string | null;
  shippingMethod?: string | null;
  shippingCost?: number;
  items: PaidOrderLine[];
};

function blankToNull(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function parseOrderAddress(value: unknown): Record<string, string> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
  return {};
}

export async function recordPaidOrder(db: Db, input: RecordPaidOrderInput) {
  const stripeSessionId = blankToNull(input.stripeSessionId);
  const deliveryLocationId = blankToNull(input.deliveryLocationId);
  const deliveryTimeSlotId = blankToNull(input.deliveryTimeSlotId);

  try {
    // Neon HTTP rejects nested writes / $transaction. Create order, then lines,
    // then inventory updates as separate single-statement queries.
    const deliveryCode = generateDeliveryCode();
    const deliveryCodeIssuedAt = new Date();

    const order = await runWithDbTransaction(db, async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: input.orderNumber,
          email: input.email,
          customerId: blankToNull(input.customerId),
          subtotal: input.subtotal,
          shipping: input.shipping,
          tax: input.tax,
          total: input.total,
          currency: input.currency ?? "CAD",
          stripeSessionId,
          stripePaymentIntentId: blankToNull(input.stripePaymentIntentId),
          status: "received",
          deliveryCode,
          deliveryCodeIssuedAt,
          shippingAddress: input.shippingAddress,
          billingAddress: input.billingAddress ?? undefined,
          deliveryLocationId,
          deliveryTimeSlotId,
          shippingMethod: blankToNull(input.shippingMethod),
          shippingCost: input.shippingCost ?? input.shipping,
        },
      });

      for (const item of input.items) {
        await tx.orderItem.create({
          data: {
            orderId: created.id,
            lineType: item.kind === "gift_card" ? "gift_card" : "product",
            productVariantId:
              item.kind === "product" ? blankToNull(item.variantId) : null,
            quantity: item.quantity,
            priceAtPurchase: item.price,
            productName: item.productName,
            variantLabel: item.variantLabel || "—",
          },
        });
      }

      for (const item of input.items) {
        if (item.kind !== "product" || !blankToNull(item.variantId)) continue;
        await tx.productVariant.update({
          where: { id: item.variantId! },
          data: { inventoryQty: { decrement: item.quantity } },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: { items: true },
      });
    });

    return { order, alreadyExisted: false as const };
  } catch (error) {
    if (!stripeSessionId || !isUniqueConflict(error)) throw error;
    const order = await db.order.findUnique({
      where: { stripeSessionId },
      include: { items: true },
    });
    if (!order) throw error;
    return { order, alreadyExisted: true as const };
  }
}

function timeWindowLabel(slot: { label: string; startTime: string; endTime: string } | null) {
  if (!slot) return null;
  return `${slot.label} (${slot.startTime}–${slot.endTime})`;
}

/**
 * Mark order refunded (once) and restore inventory / disable gift cards.
 * Safe if admin refund and `charge.refunded` webhook race.
 */
export async function applyOrderRefundSideEffects(
  db: Db,
  orderId: string
): Promise<boolean> {
  const claimed = await db.order.updateMany({
    where: { id: orderId, status: { not: "refunded" } },
    data: { status: "refunded" },
  });
  if (claimed.count === 0) return false;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return true;

  for (const item of order.items) {
    if (item.lineType === "product" && item.productVariantId) {
      await db.productVariant.update({
        where: { id: item.productVariantId },
        data: { inventoryQty: { increment: item.quantity } },
      });
    }
  }

  const giftCards = await db.giftCard.findMany({
    where: { orderId: order.id },
    select: { id: true },
  });
  for (const card of giftCards) {
    await db.giftCard.update({
      where: { id: card.id },
      data: { status: "disabled", balance: 0 },
    });
  }

  return true;
}

export async function deliverOrderConfirmation(db: Db, orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      deliveryLocation: true,
      deliveryTimeSlot: true,
    },
  });

  if (!order?.email) return false;

  const isDrop =
    order.deliveryLocation?.type === "hospital" || order.deliveryLocation?.type === "clinic";

  try {
    const reviewTargets = await resolveReviewTargetsFromOrder(db, order.items);

    const sent = await sendOrderConfirmationEmail({
      to: order.email,
      orderNumber: order.orderNumber,
      total: formatCurrency(Number(order.total)),
      tax: formatCurrency(Number(order.tax)),
      taxAmount: Number(order.tax),
      deliveryCode: order.deliveryCode,
      siteName: order.deliveryLocation?.name ?? null,
      timeWindow: timeWindowLabel(order.deliveryTimeSlot),
      handover: isDrop
        ? "We bring the order to the site in your chosen window. Someone on the unit receives it. Show your delivery code to confirm handover."
        : "Show your delivery code when you receive your order so we can mark it fulfilled.",
      reviewTargets,
      items: groupOrderLines(
        order.items.map((item) => ({
          productName: item.productName,
          variantLabel: item.variantLabel,
          quantity: item.quantity,
          priceAtPurchase: Number(item.priceAtPurchase),
        }))
      ).flatMap((group) => {
        if (group.kind === "bundle") {
          return [
            {
              name: `Bundle: ${group.name}`,
              quantity: 1,
              price: formatCurrency(group.total),
            },
            ...group.lines.map((line) => ({
              name: `  · ${line.pieceName} (${line.variantLabel})`,
              quantity: line.quantity,
              price: formatCurrency(line.priceAtPurchase * line.quantity),
            })),
          ];
        }
        const item = order.items.find(
          (row) =>
            row.productName === group.line.productName &&
            row.variantLabel === group.line.variantLabel
        );
        return [
          {
            name:
              item?.lineType === "gift_card"
                ? group.line.productName
                : `${group.line.productName} (${group.line.variantLabel})`,
            quantity: group.line.quantity,
            price: formatCurrency(group.total),
          },
        ];
      }),
    });

    if (!sent) return false;

    await db.order.update({
      where: { id: orderId },
      data: { confirmationSentAt: new Date() },
    });
    return true;
  } catch (error) {
    console.error("[email] Order confirmation failed:", error);
    return false;
  }
}
