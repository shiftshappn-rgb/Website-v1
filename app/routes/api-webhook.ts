import { data } from "react-router";
import type Stripe from "stripe";
import type { Route } from "./+types/api-webhook";
import { tryDb } from "~/db.server";
import { generateGiftCardCode } from "~/lib/commerce.server";
import {
  sendGiftCardEmail,
  sendOrderConfirmationEmail,
} from "~/lib/email.server";
import { getStripe } from "~/lib/stripe.server";
import { formatCurrency, generateOrderNumber } from "~/lib/utils";

type ProductLine = {
  kind: "product";
  variantId: string;
  quantity: number;
  price: number;
  productName: string;
  variantLabel: string;
};

type GiftCardLine = {
  kind: "gift_card";
  amount: number;
  quantity: number;
  recipientEmail?: string;
  giftNote?: string;
};

type CheckoutLine = ProductLine | GiftCardLine;

type LegacyProductLine = {
  variantId: string;
  quantity: number;
  price: number;
  productName: string;
  variantLabel: string;
};

function normalizeCheckoutLine(
  item: CheckoutLine | LegacyProductLine
): CheckoutLine {
  if ("kind" in item && item.kind) return item;
  return {
    kind: "product",
    variantId: item.variantId,
    quantity: item.quantity,
    price: item.price,
    productName: item.productName,
    variantLabel: item.variantLabel,
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw data("Method not allowed", { status: 405 });
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not configured");
    return data({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return data({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return data({ error: "Invalid signature" }, { status: 400 });
  }

  const db = tryDb();
  if (!db) {
    return data({ error: "Database unavailable" }, { status: 503 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(db, session);
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeRefunded(db, charge);
      break;
    }
    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleCheckoutCompleted(
  db: NonNullable<ReturnType<typeof tryDb>>,
  session: Stripe.Checkout.Session
) {
  const existing = await db.order.findFirst({
    where: { stripeSessionId: session.id },
  });
  if (existing) return;

  const metadata = session.metadata ?? {};
  const lineItemsRaw = metadata.lineItems;
  if (!lineItemsRaw) {
    console.error("[webhook] Missing lineItems metadata");
    return;
  }

  const lineItems = (JSON.parse(lineItemsRaw) as Array<CheckoutLine | LegacyProductLine>).map(
    normalizeCheckoutLine
  );

  const email = session.customer_details?.email ?? session.customer_email ?? "";
  const shippingAddress = session.collected_information?.shipping_details?.address
    ? {
        line1: session.collected_information.shipping_details.address.line1 ?? "",
        line2: session.collected_information.shipping_details.address.line2 ?? "",
        city: session.collected_information.shipping_details.address.city ?? "",
        province: session.collected_information.shipping_details.address.state ?? "",
        postalCode:
          session.collected_information.shipping_details.address.postal_code ?? "",
        country: session.collected_information.shipping_details.address.country ?? "CA",
      }
    : {
        line1: "",
        city: "",
        province: "",
        postalCode: "",
        country: "CA",
      };

  const subtotal = parseFloat(metadata.subtotal ?? "0");
  const shipping = parseFloat(metadata.shipping ?? "0");
  const tax = parseFloat(metadata.tax ?? "0");
  const total = parseFloat(metadata.total ?? "0");

  const order = await db.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      email,
      subtotal,
      shipping,
      tax,
      total,
      currency: "CAD",
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id,
      status: "paid",
      shippingAddress,
      items: {
        create: lineItems.map((item) => {
          if (item.kind === "gift_card") {
            return {
              lineType: "gift_card",
              quantity: item.quantity,
              priceAtPurchase: item.amount,
              productName: "ShiftsHappn e-gift card",
              variantLabel: item.recipientEmail
                ? `Digital · $${item.amount} · to ${item.recipientEmail}`
                : `Digital · $${item.amount}`,
            };
          }

          return {
            lineType: "product",
            productVariantId: item.variantId,
            quantity: item.quantity,
            priceAtPurchase: item.price,
            productName: item.productName,
            variantLabel: item.variantLabel,
          };
        }),
      },
    },
    include: { items: true },
  });

  const issuedCodes: Array<{
    code: string;
    amount: number;
    recipientEmail?: string;
    giftNote?: string;
  }> = [];

  for (const item of lineItems) {
    if (item.kind === "product") {
      await db.productVariant.update({
        where: { id: item.variantId },
        data: { inventoryQty: { decrement: item.quantity } },
      });
      continue;
    }

    for (let i = 0; i < item.quantity; i++) {
      const code = generateGiftCardCode();
      await db.giftCard.create({
        data: {
          code,
          initialAmount: item.amount,
          balance: item.amount,
          purchaserEmail: email || null,
          recipientEmail: item.recipientEmail ?? null,
          note: item.giftNote ?? null,
          source: "purchase",
          orderId: order.id,
        },
      });
      issuedCodes.push({
        code,
        amount: item.amount,
        recipientEmail: item.recipientEmail,
        giftNote: item.giftNote,
      });
    }
  }

  const discountCode = metadata.discountCode?.trim();
  if (discountCode) {
    await db.discountCode.updateMany({
      where: { code: discountCode },
      data: { usedCount: { increment: 1 } },
    });
  }

  const giftCardCode = metadata.giftCardCode?.trim();
  const giftCardAmount = parseFloat(metadata.giftCardAmount ?? "0");
  if (giftCardCode && giftCardAmount > 0) {
    const card = await db.giftCard.findUnique({ where: { code: giftCardCode } });
    if (card) {
      await db.giftCard.update({
        where: { id: card.id },
        data: { balance: Math.max(0, Number(card.balance) - giftCardAmount) },
      });
    }
  }

  const hasProducts = lineItems.some((item) => item.kind === "product");
  if (email && hasProducts) {
    const points = Math.max(0, Math.floor(subtotal));
    const customer = await db.customer.findUnique({ where: { email } });
    if (customer && points > 0) {
      await db.customer.update({
        where: { id: customer.id },
        data: { loyaltyPoints: { increment: points } },
      });
      await db.loyaltyLedger.create({
        data: {
          customerId: customer.id,
          points,
          reason: `Order ${order.orderNumber}`,
          orderId: order.id,
        },
      });
    }
  }

  if (email) {
    await sendOrderConfirmationEmail({
      to: email,
      orderNumber: order.orderNumber,
      total: formatCurrency(total),
      items: order.items.map((item) => ({
        name:
          item.lineType === "gift_card"
            ? item.productName
            : `${item.productName} (${item.variantLabel})`,
        quantity: item.quantity,
        price: formatCurrency(Number(item.priceAtPurchase) * item.quantity),
      })),
    });
  }

  for (const issued of issuedCodes) {
    if (issued.recipientEmail) {
      await sendGiftCardEmail({
        to: issued.recipientEmail,
        code: issued.code,
        amount: formatCurrency(issued.amount),
        note: issued.giftNote,
        isRecipient: true,
        bcc: email || undefined,
      });
      if (email && email !== issued.recipientEmail) {
        await sendGiftCardEmail({
          to: email,
          code: issued.code,
          amount: formatCurrency(issued.amount),
          note: issued.giftNote,
          isRecipient: false,
        });
      }
    } else if (email) {
      await sendGiftCardEmail({
        to: email,
        code: issued.code,
        amount: formatCurrency(issued.amount),
        note: issued.giftNote,
        isRecipient: false,
      });
    }
  }
}

async function handleChargeRefunded(
  db: NonNullable<ReturnType<typeof tryDb>>,
  charge: Stripe.Charge
) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) return;

  const order = await db.order.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { items: true },
  });

  if (!order || order.status === "refunded") return;

  await db.order.update({
    where: { id: order.id },
    data: { status: "refunded" },
  });

  for (const item of order.items) {
    if (item.lineType === "product" && item.productVariantId) {
      await db.productVariant.update({
        where: { id: item.productVariantId },
        data: { inventoryQty: { increment: item.quantity } },
      });
    }
  }

  await db.giftCard.updateMany({
    where: { orderId: order.id },
    data: { status: "disabled", balance: 0 },
  });
}
