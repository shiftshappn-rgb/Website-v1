import { data, redirect } from "react-router";
import type { Route } from "./+types/api-checkout";
import type { CartItem } from "~/lib/cart";
import { tryDb } from "~/db.server";
import {
  computeDiscountAmount,
  resolveDiscountCode,
  resolveGiftCard,
} from "~/lib/commerce.server";
import { getStripe } from "~/lib/stripe.server";
import { getVariantPrice } from "~/lib/utils";

const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw data("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const cartJson = formData.get("cart") as string;
  const discountCodeRaw = String(formData.get("discountCode") ?? "").trim();
  const giftCardCodeRaw = String(formData.get("giftCardCode") ?? "").trim();

  if (!cartJson) {
    return data({ error: "Cart is empty" }, { status: 400 });
  }

  let cartItems: CartItem[];
  try {
    cartItems = JSON.parse(cartJson) as CartItem[];
  } catch {
    return data({ error: "Invalid cart data" }, { status: 400 });
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return data({ error: "Cart is empty" }, { status: 400 });
  }

  const db = tryDb();
  if (!db) {
    return data({ error: "Store unavailable" }, { status: 503 });
  }

  const lineItems: Array<{
    variantId: string;
    quantity: number;
    price: number;
    productName: string;
    variantLabel: string;
  }> = [];

  for (const item of cartItems) {
    const variant = await db.productVariant.findUnique({
      where: { id: item.variantId },
      include: { product: true },
    });

    if (!variant || variant.product.status !== "active") {
      return data({ error: `Product unavailable: ${item.productName}` }, { status: 400 });
    }

    if (variant.inventoryQty < item.quantity) {
      return data(
        { error: `Insufficient stock for ${item.productName} (${item.variantLabel})` },
        { status: 400 }
      );
    }

    const price = getVariantPrice(
      Number(variant.product.basePrice),
      variant.priceOverride ? Number(variant.priceOverride) : null
    );

    lineItems.push({
      variantId: variant.id,
      quantity: item.quantity,
      price,
      productName: variant.product.name,
      variantLabel: `${variant.colorName} / ${variant.size}`,
    });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const originalShipping = subtotal >= 100 ? 0 : 9.95;
  let shipping = originalShipping;
  let discountAmount = 0;

  if (discountCodeRaw) {
    const resolved = await resolveDiscountCode(db, discountCodeRaw, subtotal);
    if ("error" in resolved) {
      return data({ error: resolved.error }, { status: 400 });
    }
    if (resolved.discount.type === "free_shipping") {
      shipping = 0;
      discountAmount = originalShipping;
    } else {
      discountAmount = computeDiscountAmount(
        resolved.discount.type,
        Number(resolved.discount.value),
        subtotal,
        shipping
      );
    }
  }

  const merchandise = Math.max(0, subtotal - (shipping === 0 && discountAmount === originalShipping ? 0 : Math.min(discountAmount, subtotal)));
  let giftCardAmount = 0;

  if (giftCardCodeRaw) {
    const resolved = await resolveGiftCard(db, giftCardCodeRaw);
    if ("error" in resolved) {
      return data({ error: resolved.error }, { status: 400 });
    }
    giftCardAmount = Math.min(Number(resolved.card.balance), merchandise + shipping);
  }

  const tax = Math.round((merchandise + shipping - giftCardAmount) * 0.13 * 100) / 100;
  const total = Math.max(0, merchandise + shipping - giftCardAmount + tax);
  const stripeOriginal = subtotal + originalShipping;
  const stripePayable = merchandise + shipping - giftCardAmount;
  const stripeDiscountCents = Math.round((stripeOriginal - stripePayable) * 100);

  const stripe = getStripe();
  const discounts =
    stripeDiscountCents > 0
      ? [
          {
            coupon: (
              await stripe.coupons.create({
                amount_off: stripeDiscountCents,
                currency: "cad",
                duration: "once",
                name: [discountCodeRaw, giftCardCodeRaw].filter(Boolean).join(" + ") || "Offer",
              })
            ).id,
          },
        ]
      : undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems.map((item) => ({
      price_data: {
        currency: "cad",
        product_data: {
          name: item.productName,
          description: item.variantLabel,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    })),
    shipping_options:
      originalShipping > 0
        ? [
            {
              shipping_rate_data: {
                type: "fixed_amount",
                fixed_amount: { amount: Math.round(originalShipping * 100), currency: "cad" },
                display_name: "Standard shipping",
              },
            },
          ]
        : undefined,
    discounts,
    automatic_tax: { enabled: false },
    metadata: {
      lineItems: JSON.stringify(
        lineItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          price: item.price,
          productName: item.productName,
          variantLabel: item.variantLabel,
        }))
      ),
      subtotal: subtotal.toFixed(2),
      shipping: shipping.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      discountCode: discountCodeRaw.toUpperCase(),
      giftCardCode: giftCardCodeRaw.toUpperCase(),
      giftCardAmount: giftCardAmount.toFixed(2),
    },
    success_url: `${APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/`,
  });

  if (!session.url) {
    return data({ error: "Failed to create checkout session" }, { status: 500 });
  }

  return redirect(session.url);
}
