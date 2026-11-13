import { redirect } from "react-router";
import type { Route } from "./+types/api-checkout-payment";
import { tryDb } from "~/db.server";
import {
  buildCheckoutQuote,
  incrementDiscountUsageAtomic,
  redeemGiftCardAtomic,
} from "~/lib/checkout-pricing.server";
import {
  assertSameOrigin,
  rateLimit,
} from "~/lib/checkout-security.server";
import { validatePhase2Fields } from "~/lib/checkout-validation";
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
import { formatCurrency, generateOrderNumber } from "~/lib/utils";
import { isValidEmail, normalizeEmail, validateAddress } from "~/lib/validation";

type Phase1 = {
  email?: string;
  giftCardCode?: string;
  promoCode?: string;
  hasGiftCards?: boolean;
  hasProducts?: boolean;
};

type Phase2 = {
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
    phone?: string;
  };
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function buildAddresses(phase1: Phase1, phase2: Phase2, isGiftCardsOnly: boolean) {
  if (isGiftCardsOnly) {
    const addr = {
      name: phase1.email ?? "",
      line1: "Digital delivery",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      country: "CA",
    };
    return { shippingAddress: addr, billingAddress: addr };
  }

  const isHospitalOrClinic =
    phase2.deliveryLocationType === "hospital" ||
    phase2.deliveryLocationType === "clinic";

  if (isHospitalOrClinic) {
    const shippingAddress = {
      name: phase2.billingAddress?.name || phase1.email || "",
      line1: phase2.deliveryLocationName || "",
      city: "Halifax",
      province: "NS",
      postalCode: "",
      country: "CA",
      phone: phase2.billingAddress?.phone,
    };
    return {
      shippingAddress,
      billingAddress: phase2.billingAddress || shippingAddress,
    };
  }

  const validated = validateAddress(phase2.billingAddress ?? {}, {
    requirePhone: true,
    requireName: true,
  });
  if (!validated.ok) {
    return { error: validated.fieldErrors };
  }
  return {
    shippingAddress: validated.value,
    billingAddress: validated.value,
  };
}

/** Resource route for checkout PaymentIntent + place-order (plain fetch → JSON). */
export async function action({ request }: Route.ActionArgs) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) return json({ error: origin.error }, 403);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "place-order");

  const db = tryDb();
  if (!db) return json({ error: "Store unavailable" }, 503);

  let phase1: Phase1;
  let phase2: Phase2;
  let cartItems: unknown;
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

  const email = normalizeEmail(phase1.email ?? "");
  if (!email || !isValidEmail(email)) {
    return json({ error: "A valid email is required." }, 400);
  }

  const isGiftCardsOnly = Boolean(phase1.hasGiftCards && !phase1.hasProducts);
  const phase2Check = validatePhase2Fields({
    isGiftCardsOnly,
    deliveryLocationId: phase2.deliveryLocationId,
    deliveryLocationType: phase2.deliveryLocationType,
    deliveryTimeSlotId: phase2.deliveryTimeSlotId,
    shippingMethod: phase2.shippingMethod,
    billingAddress: phase2.billingAddress,
  });
  if (Object.keys(phase2Check.fieldErrors).length > 0) {
    return json(
      {
        error: Object.values(phase2Check.fieldErrors)[0],
        fieldErrors: phase2Check.fieldErrors,
      },
      400
    );
  }

  const quoted = await buildCheckoutQuote(db, {
    cartItems,
    promoCode: phase1.promoCode,
    giftCardCode: phase1.giftCardCode,
    phase2: {
      deliveryLocationId: phase2.deliveryLocationId,
      deliveryLocationType: phase2.deliveryLocationType,
      deliveryTimeSlotId: phase2.deliveryTimeSlotId,
      shippingMethod: phase2.shippingMethod,
      isGiftCardsOnly,
    },
    email,
  });
  if (!quoted.ok) {
    return json(
      { error: quoted.error, fieldErrors: quoted.fieldErrors },
      400
    );
  }
  const quote = quoted.quote;

  if (intent === "create-payment-intent") {
    const limited = await rateLimit(request, "checkout-pi", {
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return json({ error: limited.error }, 429);
    }

    if (quote.total <= 0) {
      return json({
        clientSecret: null,
        paymentIntentId: null,
        amountCents: 0,
        quoteHash: quote.quoteHash,
        total: quote.total,
      });
    }
    try {
      const paymentIntent = await createCheckoutPaymentIntent({
        amountCad: quote.total,
        email,
        metadata: {
          amountCad: String(quote.total),
          quoteHash: quote.quoteHash,
          cartFingerprint: quote.cartFingerprint,
          email,
        },
        idempotencyKey: `pi:${quote.cartFingerprint}:${quote.quoteHash}`,
      });
      return json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountCents: paymentIntent.amount,
        quoteHash: quote.quoteHash,
        total: quote.total,
        tax: quote.tax,
        shippingCost: quote.shippingCost,
        subtotal: quote.subtotal,
        discountAmount: quote.discountAmount,
        giftCardAmount: quote.giftCardAmount,
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

  const limited = await rateLimit(request, "checkout-place", {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return json({ error: limited.error }, 429);
  }

  if (formData.get("agreePolicies") !== "on") {
    return json(
      { error: "Please agree to the Delivery, Returns, and Privacy policies." },
      400
    );
  }

  const sessionCustomer = await getCustomer(request);
  const customerId = sessionCustomer?.id ?? null;
  const orderEmail = sessionCustomer?.email
    ? normalizeEmail(sessionCustomer.email)
    : email;
  const paymentIntentId = String(formData.get("paymentIntentId") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim() || null;

  if (idempotencyKey) {
    const existingByKey = await db.order.findUnique({
      where: { idempotencyKey },
      select: { orderNumber: true },
    });
    if (existingByKey) {
      return redirect(checkoutSuccessPath(existingByKey.orderNumber));
    }
  }

  try {
    if (quote.total > 0) {
      if (!paymentIntentId) {
        return json({ error: "Missing payment confirmation." }, 400);
      }
      if (paymentIntentId.startsWith("pi_mock_")) {
        return json({ error: "Invalid payment." }, 400);
      }

      const existing = await db.order.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
        select: { orderNumber: true },
      });
      if (existing) {
        return redirect(checkoutSuccessPath(existing.orderNumber));
      }

      const paymentIntent = await retrieveSucceededPaymentIntent(
        paymentIntentId,
        dollarsToCents(quote.total)
      );

      const metaEmail = (paymentIntent.metadata?.email ?? "").toLowerCase();
      const metaHash = paymentIntent.metadata?.quoteHash ?? "";
      const metaFingerprint = paymentIntent.metadata?.cartFingerprint ?? "";
      if (metaEmail && metaEmail !== orderEmail) {
        return json({ error: "Payment email does not match this order." }, 400);
      }
      if (metaHash && metaHash !== quote.quoteHash) {
        return json(
          { error: "Your cart or totals changed. Please refresh payment and try again." },
          409
        );
      }
      if (metaFingerprint && metaFingerprint !== quote.cartFingerprint) {
        return json(
          { error: "Your cart changed. Please refresh payment and try again." },
          409
        );
      }
    }

    const addresses = buildAddresses(
      { ...phase1, email: orderEmail },
      phase2,
      isGiftCardsOnly
    );
    if ("error" in addresses) {
      return json(
        {
          error: Object.values(addresses.error!)[0] ?? "Invalid address.",
          fieldErrors: addresses.error,
        },
        400
      );
    }

    const orderNumber = generateOrderNumber();

    const { order, alreadyExisted } = await recordPaidOrder(db, {
      orderNumber,
      email: orderEmail,
      customerId,
      subtotal: quote.subtotal,
      shipping: quote.shippingCost,
      tax: quote.tax,
      total: quote.total,
      discountAmount: quote.discountAmount,
      giftCardAmount: quote.giftCardAmount,
      promoCode: quote.promoCode,
      giftCardCode: quote.giftCardCode,
      idempotencyKey,
      stripePaymentIntentId: quote.total > 0 ? paymentIntentId : null,
      shippingAddress: addresses.shippingAddress,
      billingAddress: addresses.billingAddress,
      deliveryLocationId: quote.deliveryLocationId ?? phase2.deliveryLocationId,
      deliveryTimeSlotId: quote.deliveryTimeSlotId ?? phase2.deliveryTimeSlotId,
      shippingMethod: quote.shippingMethod,
      shippingCost: quote.shippingCost,
      items: quote.lines.map((item) => ({
        kind: item.kind,
        variantId: item.variantId,
        quantity: item.quantity,
        price: item.price,
        productName: item.productName || "Gift Card",
        variantLabel: item.variantLabel || "",
      })),
    });

    if (!alreadyExisted) {
      try {
        if (quote.giftCardCode && quote.giftCardAmount > 0) {
          const redeemed = await redeemGiftCardAtomic(
            db,
            quote.giftCardCode,
            quote.giftCardAmount
          );
          if (!redeemed) {
            console.error("[checkout] Gift card redeem failed after payment", {
              order: order.orderNumber,
              code: quote.giftCardCode,
            });
          }
        }

        if (quote.promoCode) {
          const incremented = await incrementDiscountUsageAtomic(db, quote.promoCode);
          if (!incremented) {
            console.error("[checkout] Promo usage increment failed", {
              order: order.orderNumber,
              code: quote.promoCode,
            });
          }
        }

        if (customerId && quote.hasProducts) {
          const points = Math.max(0, Math.floor(quote.subtotal));
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
          orderEmail,
          customerId
            ? (
                await db.customer.findUnique({
                  where: { id: customerId },
                  select: { name: true },
                })
              )?.name
            : null
        );

        for (const item of quote.lines) {
          if (item.kind !== "gift_card") continue;
          const amount = item.giftAmount ?? item.price;
          for (let i = 0; i < item.quantity; i++) {
            const code = generateGiftCardCode();
            await db.giftCard.create({
              data: {
                code,
                initialAmount: amount,
                balance: amount,
                purchaserEmail: orderEmail || null,
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
    }

    return redirect(checkoutSuccessPath(order.orderNumber));
  } catch (error) {
    console.error("Order creation error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to place order. Please try again.";
    return json({ error: message }, 500);
  }
}
