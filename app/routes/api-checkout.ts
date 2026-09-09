import { data, redirect } from "react-router";
import type { Route } from "./+types/api-checkout";
import type { CartItem } from "~/lib/cart";
import { tryDb } from "~/db.server";
import { getStripe } from "~/lib/stripe.server";
import { getVariantPrice } from "~/lib/utils";

const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw data("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const cartJson = formData.get("cart") as string;

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
  const shipping = subtotal >= 100 ? 0 : 9.95;
  const tax = Math.round((subtotal + shipping) * 0.13 * 100) / 100;
  const total = subtotal + shipping + tax;

  const stripe = getStripe();

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
    shipping_options: shipping > 0
      ? [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: Math.round(shipping * 100), currency: "cad" },
              display_name: "Standard shipping",
            },
          },
        ]
      : undefined,
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
    },
    success_url: `${APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/`,
  });

  if (!session.url) {
    return data({ error: "Failed to create checkout session" }, { status: 500 });
  }

  return redirect(session.url);
}
