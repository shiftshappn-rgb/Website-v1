import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-orders-detail";
import { Badge, Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { getStripe } from "~/lib/stripe.server";
import { formatCurrency } from "~/lib/utils";
import { requireAdmin } from "~/lib/session.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      giftCards: true,
      customer: { select: { name: true, email: true } },
    },
  });

  if (!order) {
    throw new Response("Order not found", { status: 404 });
  }

  return {
    dbAvailable: true as const,
    order: {
      ...order,
      subtotal: Number(order.subtotal),
      shipping: Number(order.shipping),
      tax: Number(order.tax),
      total: Number(order.total),
      items: order.items.map((i) => ({
        ...i,
        priceAtPurchase: Number(i.priceAtPurchase),
      })),
      giftCards: order.giftCards.map((card) => ({
        id: card.id,
        code: card.code,
        balance: Number(card.balance),
        initialAmount: Number(card.initialAmount),
        recipientEmail: card.recipientEmail,
        status: card.status,
      })),
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  const order = await db.order.findUnique({ where: { id: params.id } });
  if (!order) {
    return { error: "Order not found." };
  }

  if (intent === "fulfill") {
    if (order.status !== "paid") {
      return { error: "Only paid orders can be marked as fulfilled." };
    }

    await db.order.update({
      where: { id: params.id },
      data: { status: "fulfilled" },
    });

    return redirect(`/admin/orders/${params.id}`);
  }

  if (intent === "refund") {
    if (!order.stripePaymentIntentId) {
      return { error: "No Stripe payment intent found for this order." };
    }

    if (order.status === "refunded") {
      return { error: "Order is already refunded." };
    }

    try {
      const stripe = getStripe();
      await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
      });

      await db.order.update({
        where: { id: params.id },
        data: { status: "refunded" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refund failed.";
      return { error: message };
    }

    return redirect(`/admin/orders/${params.id}`);
  }

  return { error: "Unknown action." };
}

export default function AdminOrdersDetail({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { order } = loaderData;
  const shippingAddress = order.shippingAddress as Record<string, string>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-navy">{order.orderNumber}</h1>
          <p className="text-sm text-charcoal/60">
            {new Date(order.createdAt).toLocaleString()} · {order.email}
          </p>
        </div>
        <Badge
          variant={
            order.status === "fulfilled"
              ? "success"
              : order.status === "refunded"
                ? "default"
                : "terracotta"
          }
        >
          {order.status}
        </Badge>
      </div>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-serif text-lg text-navy">Order Summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-charcoal/60">Subtotal</dt>
              <dd>{formatCurrency(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-charcoal/60">Shipping</dt>
              <dd>{formatCurrency(order.shipping)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-charcoal/60">Tax</dt>
              <dd>{formatCurrency(order.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-charcoal/10 pt-2 font-medium">
              <dt>Total</dt>
              <dd>{formatCurrency(order.total)}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg text-navy">Shipping Address</h2>
          <address className="text-sm not-italic text-charcoal/80">
            {shippingAddress.line1}
            {shippingAddress.line2 && <>, {shippingAddress.line2}</>}
            <br />
            {shippingAddress.city}, {shippingAddress.province} {shippingAddress.postalCode}
            <br />
            {shippingAddress.country}
          </address>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 font-serif text-lg text-navy">Items</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-charcoal/10 text-left">
              <th className="pb-2 font-medium">Product</th>
              <th className="pb-2 font-medium">Variant</th>
              <th className="pb-2 font-medium">Qty</th>
              <th className="pb-2 font-medium text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-charcoal/5">
                <td className="py-2">
                  {item.productName}
                  {item.lineType === "gift_card" && (
                    <Badge variant="default" className="ml-2">
                      E-gift
                    </Badge>
                  )}
                </td>
                <td className="py-2 text-charcoal/60">{item.variantLabel}</td>
                <td className="py-2">{item.quantity}</td>
                <td className="py-2 text-right">{formatCurrency(item.priceAtPurchase)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {order.giftCards.length > 0 && (
        <Card>
          <h2 className="mb-4 font-serif text-lg text-navy">Issued gift cards</h2>
          <div className="space-y-3">
            {order.giftCards.map((card) => (
              <div
                key={card.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-charcoal/10 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-mono font-medium text-navy">{card.code}</p>
                  <p className="text-charcoal/60">
                    {formatCurrency(card.balance)} left of {formatCurrency(card.initialAmount)}
                    {card.recipientEmail ? ` · ${card.recipientEmail}` : ""}
                  </p>
                </div>
                <Badge variant={card.status === "active" ? "success" : "default"}>
                  {card.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        {order.status === "paid" && (
          <Form method="post">
            <input type="hidden" name="intent" value="fulfill" />
            <Button type="submit">Mark Fulfilled</Button>
          </Form>
        )}
        {order.stripePaymentIntentId && order.status !== "refunded" && (
          <Form method="post">
            <input type="hidden" name="intent" value="refund" />
            <Button type="submit" variant="outline" className="text-red-600">
              Issue Refund
            </Button>
          </Form>
        )}
      </div>
    </div>
  );
}
