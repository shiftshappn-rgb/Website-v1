import { redirect } from "react-router";
import type { Route } from "./+types/api-checkout-payment";
import { tryDb } from "~/db.server";
import type { CartItem } from "~/lib/checkout-context";
import { generateGiftCardCode } from "~/lib/commerce.server";
import { sendGiftCardEmail } from "~/lib/email.server";
import { resolveGiftCardFromLabel } from "~/lib/gift-card.server";
import { checkoutSuccessPath } from "~/lib/order-access.server";
import { deliverOrderConfirmation, recordPaidOrder } from "~/lib/paid-order.server";
import { getCustomer } from "~/lib/session.server";
import {
  createCheckoutPaymentIntent,
  dollarsToCents,
  retrieveSucceededPaymentIntent,
} from "~/lib/stripe.server";
import { computeTaxAmount } from "~/lib/tax";
import { loadTaxRatePercent } from "~/lib/tax.server";
import { formatCurrency } from "~/lib/utils";

type Phase1 = {
  email?: string;
  subtotal?: number;
  discountAmount?: number;
  giftCardAmount?: number;
  giftCardCode?: string;
  promoCode?: string;
};

type Phase2 = {
  shippingCost?: number;
  deliveryLocationType?: string;
  deliveryLocationName?: string;
  deliveryLocationId?: string;
  deliveryTimeSlotId?: string;
  deliveryTimeSlotLabel?: string;
  shippingMethod?: string;
  billingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
};

function computeTotals(phase1: Phase1, phase2: Phase2, taxRatePercent: number) {
  const subtotal = Number(phase1.subtotal ?? 0);
  const discountAmount = Number(phase1.discountAmount ?? 0);
  const giftCardAmount = Number(phase1.giftCardAmount ?? 0);
  const shippingCost = Number(phase2.shippingCost ?? 0);
  const merchandise = Math.max(0, subtotal - discountAmount - giftCardAmount);
  const tax = computeTaxAmount(merchandise + shippingCost, taxRatePercent);
  const total = Math.max(0, merchandise + shippingCost + tax);
  return {
    subtotal,
    discountAmount,
    giftCardAmount,
    shippingCost,
    merchandise,
    tax,
    total,
    taxRatePercent,
  };
}

function buildAddresses(phase1: Phase1, phase2: Phase2) {
  const isHospitalOrClinic =
    phase2.deliveryLocationType === "hospital" || phase2.deliveryLocationType === "clinic";

  const shippingAddress = isHospitalOrClinic
    ? {
        name: phase1.email ?? "",
        line1: "",
        city: "Halifax",
        province: "NS",
        postalCode: "",
        country: "CA",
      }
    : {
        name: phase2.billingAddress?.name || phase1.email || "",
        line1: phase2.billingAddress?.line1 || "",
        line2: phase2.billingAddress?.line2 || "",
        city: phase2.billingAddress?.city || "",
        province: phase2.billingAddress?.province || "",
        postalCode: phase2.billingAddress?.postalCode || "",
        country: phase2.billingAddress?.country || "CA",
      };

  return {
    shippingAddress,
    billingAddress: phase2.billingAddress || shippingAddress,
  };
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

/** Resource route for checkout PaymentIntent + place-order (plain fetch → JSON). */
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "place-order");

  const db = tryDb();
  if (!db) return json({ error: "Store unavailable" }, 503);

  let phase1: Phase1;
  let phase2: Phase2;
  let cartItems: CartItem[];
  try {
    phase1 = JSON.parse(String(formData.get("phase1") ?? "null"));
    phase2 = JSON.parse(String(formData.get("phase2") ?? "null"));
    cartItems = JSON.parse(String(formData.get("cartItems") ?? "[]"));
  } catch {
    return json({ error: "Invalid form data" }, 400);
  }

  if (!phase1 || !phase2) {
    return json({ error: "Missing prior phase data" }, 400);
  }
  if (!phase1.email?.trim()) {
    return json({ error: "Email is required." }, 400);
  }
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return json({ error: "Your cart is empty." }, 400);
  }

  const taxRatePercent = await loadTaxRatePercent(db);
  const totals = computeTotals(phase1, phase2, taxRatePercent);

  if (intent === "create-payment-intent") {
    if (totals.total <= 0) {
      return json({ clientSecret: null, paymentIntentId: null, amountCents: 0 });
    }
    try {
      const paymentIntent = await createCheckoutPaymentIntent({
        amountCad: totals.total,
        email: phase1.email.trim(),
        metadata: {
          amountCad: String(totals.total),
        },
      });
      return json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountCents: paymentIntent.amount,
      });
    } catch (error) {
      console.error("[checkout] PaymentIntent create failed:", error);
      const message =
        error instanceof Error ? error.message : "Unable to start payment.";
      return json({ error: message }, 500);
    }
  }

  if (intent !== "place-order") {
    return json({ error: "Unknown intent" }, 400);
  }

  if (formData.get("agreePolicies") !== "on") {
    return json(
      { error: "Please agree to the Delivery, Returns, and Privacy policies." },
      400
    );
  }

  const sessionCustomer = await getCustomer(request);
  const customerId = sessionCustomer?.id ?? null;
  const paymentIntentId = String(formData.get("paymentIntentId") ?? "").trim();

  try {
    if (totals.total > 0) {
      if (!paymentIntentId) {
        return json({ error: "Missing payment confirmation." }, 400);
      }
      if (paymentIntentId.startsWith("pi_mock_")) {
        return json({ error: "Invalid payment." }, 400);
      }

      const existing = await db.order.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
        select: { orderNumber: true },
      });
      if (existing) {
        return redirect(checkoutSuccessPath(existing.orderNumber));
      }

      await retrieveSucceededPaymentIntent(
        paymentIntentId,
        dollarsToCents(totals.total)
      );
    }

    const orderNumber = `SH-${Date.now().toString(36).slice(2).toUpperCase()}`;
    const { shippingAddress, billingAddress } = buildAddresses(phase1, phase2);

    const { order } = await recordPaidOrder(db, {
      orderNumber,
      email: phase1.email.trim(),
      customerId,
      subtotal: totals.subtotal,
      shipping: totals.shippingCost,
      tax: totals.tax,
      total: totals.total,
      stripePaymentIntentId: totals.total > 0 ? paymentIntentId : null,
      shippingAddress,
      billingAddress,
      deliveryLocationId: phase2.deliveryLocationId,
      deliveryTimeSlotId: phase2.deliveryTimeSlotId,
      shippingMethod: phase2.shippingMethod,
      shippingCost: totals.shippingCost,
      items: cartItems.map((item) => ({
        kind: item.kind === "gift_card" ? "gift_card" : "product",
        variantId: item.kind === "gift_card" ? null : item.variantId,
        quantity: item.quantity,
        price: item.giftAmount ?? item.price,
        productName: item.productName || "Gift Card",
        variantLabel: item.variantLabel || "",
      })),
    });

    try {
      if (phase1.giftCardCode && totals.giftCardAmount > 0) {
        const card = await db.giftCard.findUnique({
          where: { code: String(phase1.giftCardCode).trim().toUpperCase() },
        });
        if (card) {
          await db.giftCard.update({
            where: { id: card.id },
            data: {
              balance: Math.max(0, Number(card.balance) - totals.giftCardAmount),
            },
          });
        }
      }

      if (phase1.promoCode) {
        const promo = await db.discountCode.findUnique({
          where: { code: String(phase1.promoCode).trim().toUpperCase() },
          select: { id: true },
        });
        if (promo) {
          await db.discountCode.update({
            where: { id: promo.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      const hasProducts = cartItems.some((item) => item.kind !== "gift_card");
      if (customerId && hasProducts) {
        const points = Math.max(0, Math.floor(totals.subtotal));
        if (points > 0) {
          await db.customer.update({
            where: { id: customerId },
            data: { loyaltyPoints: { increment: points } },
          });
          await db.loyaltyLedger.create({
            data: {
              customerId,
              points,
              reason: `Order ${order.orderNumber}`,
              orderId: order.id,
            },
          });
        }
      }

      const giftFromLabel = await resolveGiftCardFromLabel(
        db,
        phase1.email,
        customerId
          ? (
              await db.customer.findUnique({
                where: { id: customerId },
                select: { name: true },
              })
            )?.name
          : null
      );

      for (const item of cartItems) {
        if (item.kind !== "gift_card") continue;
        const amount = item.giftAmount ?? item.price;
        for (let i = 0; i < item.quantity; i++) {
          const code = generateGiftCardCode();
          await db.giftCard.create({
            data: {
              code,
              initialAmount: amount,
              balance: amount,
              purchaserEmail: phase1.email || null,
              recipientEmail: item.recipientEmail ?? null,
              note: item.giftNote ?? null,
              source: "purchase",
              orderId: order.id,
            },
          });
          if (item.recipientEmail) {
            try {
              await sendGiftCardEmail({
                to: item.recipientEmail,
                code,
                amount: formatCurrency(amount),
                note: item.giftNote,
                fromLabel: giftFromLabel,
                isRecipient: true,
              });
            } catch (error) {
              console.error("Gift card email failed:", error);
            }
          }
        }
      }

      if (formData.get("marketingOptIn") === "on" && customerId) {
        try {
          await db.customer.update({
            where: { id: customerId },
            data: { marketingOptIn: true },
          });
        } catch (error) {
          console.error("Marketing opt-in update failed:", error);
        }
      }

      await deliverOrderConfirmation(db, order.id);
    } catch (error) {
      console.error("Order follow-up failed:", error);
    }

    return redirect(checkoutSuccessPath(order.orderNumber));
  } catch (error) {
    console.error("Order creation error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to place order. Please try again.";
    return json({ error: message }, 500);
  }
}
