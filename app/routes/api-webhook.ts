import { data } from "react-router";
import type Stripe from "stripe";
import type { Route } from "./+types/api-webhook";
import { tryDb } from "~/db.server";
import { sendOrderConfirmationEmail } from "~/lib/email.server";
import { getStripe } from "~/lib/stripe.server";
import { formatCurrency, generateOrderNumber } from "~/lib/utils";

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

  const lineItems = JSON.parse(lineItemsRaw) as Array<{
    variantId: string;
    quantity: number;
    price: number;
    productName: string;
    variantLabel: string;
  }>;

  const email = session.customer_details?.email ?? session.customer_email ?? "";
  const shippingAddress = session.collected_information?.shipping_details?.address
    ? {
        line1: session.collected_information.shipping_details.address.line1 ?? "",
        line2: session.collected_information.shipping_details.address.line2 ?? "",
        city: session.collected_information.shipping_details.address.city ?? "",
        province: session.collected_information.shipping_details.address.state ?? "",
        postalCode: session.collected_information.shipping_details.address.postal_code ?? "",
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
        create: lineItems.map((item) => ({
          productVariantId: item.variantId,
          quantity: item.quantity,
          priceAtPurchase: item.price,
          productName: item.productName,
          variantLabel: item.variantLabel,
        })),
      },
    },
    include: { items: true },
  });

  for (const item of lineItems) {
    await db.productVariant.update({
      where: { id: item.variantId },
      data: { inventoryQty: { decrement: item.quantity } },
    });
  }

  await sendOrderConfirmationEmail({
    to: email,
    orderNumber: order.orderNumber,
    total: formatCurrency(total),
    items: order.items.map((item) => ({
      name: `${item.productName} (${item.variantLabel})`,
      quantity: item.quantity,
      price: formatCurrency(Number(item.priceAtPurchase) * item.quantity),
    })),
  });
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
    await db.productVariant.update({
      where: { id: item.productVariantId },
      data: { inventoryQty: { increment: item.quantity } },
    });
  }
}
