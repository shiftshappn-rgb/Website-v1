import { Prisma, type PrismaClient } from "@prisma/client";
import { sendOrderConfirmationEmail } from "~/lib/email.server";
import { resolveReviewTargetsFromOrder } from "~/lib/review-targets.server";
import { groupOrderLines } from "~/lib/order-line-groups";
import { formatCurrency } from "~/lib/utils";

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
    const order = await db.$transaction(async (tx) => {
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
          status: "paid",
          shippingAddress: input.shippingAddress,
          billingAddress: input.billingAddress ?? undefined,
          deliveryLocationId,
          deliveryTimeSlotId,
          shippingMethod: blankToNull(input.shippingMethod),
          shippingCost: input.shippingCost ?? input.shipping,
          items: {
            create: input.items.map((item) => ({
              lineType: item.kind === "gift_card" ? "gift_card" : "product",
              productVariantId:
                item.kind === "product" ? blankToNull(item.variantId) : null,
              quantity: item.quantity,
              priceAtPurchase: item.price,
              productName: item.productName,
              variantLabel: item.variantLabel || "—",
            })),
          },
        },
        include: { items: true },
      });

      for (const item of input.items) {
        if (item.kind !== "product" || !blankToNull(item.variantId)) continue;
        await tx.productVariant.update({
          where: { id: item.variantId! },
          data: { inventoryQty: { decrement: item.quantity } },
        });
      }

      return created;
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
      siteName: order.deliveryLocation?.name ?? null,
      timeWindow: timeWindowLabel(order.deliveryTimeSlot),
      handover: isDrop
        ? "We bring the order to the site in your chosen window. Someone on the unit receives it."
        : null,
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
