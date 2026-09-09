import { Link, data } from "react-router";
import type { Route } from "./+types/checkout-success";
import { tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";
import { formatCurrency } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Order confirmed — shiftshappn",
    description: "Your shiftshappn order has been confirmed.",
    path: "/checkout/success",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    throw data("Missing session", { status: 400 });
  }

  const db = tryDb();
  if (!db) {
    return { order: null, sessionId };
  }

  const order = await db.order.findFirst({
    where: { stripeSessionId: sessionId },
    include: { items: true },
  });

  if (!order) {
    return { order: null, sessionId };
  }

  return {
    order: {
      orderNumber: order.orderNumber,
      email: order.email,
      total: Number(order.total),
      status: order.status,
      items: order.items.map((item) => ({
        productName: item.productName,
        variantLabel: item.variantLabel,
        quantity: item.quantity,
        priceAtPurchase: Number(item.priceAtPurchase),
      })),
    },
    sessionId,
  };
}

export default function CheckoutSuccess({ loaderData }: Route.ComponentProps) {
  const { order } = loaderData;

  return (
    <div className="min-h-screen bg-sand flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-sage/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-serif text-navy mb-2">Thank you!</h1>

        {order ? (
          <>
            <p className="text-charcoal/70 mb-6">
              Your order <strong>{order.orderNumber}</strong> has been confirmed.
              A confirmation email has been sent to {order.email}.
            </p>
            <p className="text-2xl font-medium text-navy mb-8">
              {formatCurrency(order.total)}
            </p>
            <ul className="text-left text-sm text-charcoal/80 space-y-2 mb-8 p-6 bg-white rounded-xl border border-charcoal/10">
              {order.items.map((item, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {item.productName} — {item.variantLabel} × {item.quantity}
                  </span>
                  <span>{formatCurrency(item.priceAtPurchase * item.quantity)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-charcoal/70 mb-8">
            Your payment was successful. Order details will appear shortly.
          </p>
        )}

        <Link
          to="/"
          className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-navy text-white font-medium hover:bg-navy/90 transition-colors"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
