import { Link, data } from "react-router";
import type { Route } from "./+types/checkout-success";
import { OrderLineGroups } from "~/components/storefront/OrderLineGroups";
import { tryDb } from "~/db.server";
import { verifyOrderAccessToken } from "~/lib/order-access.server";
import { resolveReviewTargetsFromOrder } from "~/lib/review-targets.server";
import { buildMeta } from "~/lib/seo";
import { getCustomer } from "~/lib/session.server";
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
  const accessToken = url.searchParams.get("t");

  if (!sessionId) {
    throw data("Missing session", { status: 400 });
  }

  const empty = {
    order: null,
    sessionId,
    reviewTargets: [] as Array<{ label: string; href: string }>,
  };

  const db = tryDb();
  if (!db) return empty;

  // Stripe Checkout Session ids are unguessable — allow lookup by that alone.
  if (sessionId.startsWith("cs_")) {
    const order = await db.order.findFirst({
      where: { stripeSessionId: sessionId },
      include: { items: true },
    });
    if (!order) return empty;

    const reviewTargets = await resolveReviewTargetsFromOrder(db, order.items);
    return {
      order: serializeOrder(order),
      sessionId,
      reviewTargets,
    };
  }

  // Order-number URLs require a signed access token or the owning customer session.
  const candidate = await db.order.findFirst({
    where: { orderNumber: sessionId },
    include: { items: true },
  });

  if (!candidate) return empty;

  const hasToken = verifyOrderAccessToken(candidate.orderNumber, accessToken);
  if (!hasToken) {
    const customer = await getCustomer(request);
    if (!customer || candidate.customerId !== customer.id) {
      return empty;
    }
  }

  const reviewTargets = await resolveReviewTargetsFromOrder(db, candidate.items);

  return {
    order: serializeOrder(candidate),
    sessionId,
    reviewTargets,
  };
}

function serializeOrder(order: {
  orderNumber: string;
  email: string;
  total: { toString(): string } | number;
  status: string;
  items: Array<{
    productName: string;
    variantLabel: string;
    quantity: number;
    priceAtPurchase: { toString(): string } | number;
  }>;
}) {
  return {
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
  };
}

export default function CheckoutSuccess({ loaderData }: Route.ComponentProps) {
  const { order, reviewTargets } = loaderData;

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sage/30">
          <svg className="h-8 w-8 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="mb-2 font-serif text-3xl text-navy">Thank you!</h1>

        {order ? (
          <>
            <p className="mb-6 text-charcoal/70">
              Your order <strong>{order.orderNumber}</strong> has been confirmed. A confirmation
              email has been sent to {order.email}.
            </p>
            <p className="mb-8 text-2xl font-medium text-navy">{formatCurrency(order.total)}</p>
            <div className="mb-8 rounded-xl border border-charcoal/10 bg-white p-6 text-left">
              <OrderLineGroups items={order.items} className="space-y-4" />
            </div>
          </>
        ) : (
          <p className="mb-8 text-charcoal/70">
            Your payment was successful. Order details will appear shortly.
          </p>
        )}

        {reviewTargets.length > 0 ? (
          <div className="mb-8 rounded-2xl border border-navy/10 bg-white/90 p-6 text-left shadow-[0_14px_36px_rgba(17,26,34,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-navy/45">
              After your first shift
            </p>
            <h2 className="mt-2 font-serif text-2xl tracking-tight text-navy">
              Leave a review
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal/60">
              Tell us how the fit felt — reviews help the next nurse pick the right size. Orders
              placed while signed in earn a verified purchase badge.
            </p>
            <ul className="mt-5 space-y-2">
              {reviewTargets.map((target) => (
                <li key={target.href}>
                  <Link
                    to={target.href}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-navy underline-offset-4 transition-colors hover:text-terracotta hover:underline"
                  >
                    Review {target.label} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-full bg-navy px-8 py-3 font-medium text-white transition-colors hover:bg-navy/90"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
