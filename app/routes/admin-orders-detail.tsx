import { Form, redirect } from "react-router";
import type { Route } from "./+types/admin-orders-detail";
import { Badge, Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { groupOrderLines } from "~/lib/order-line-groups";
import {
  canFulfillWithCode,
  canInitiateRefund,
  canStartProcessing,
  orderStatusLabel,
} from "~/lib/order-status";
import { applyOrderRefundSideEffects } from "~/lib/paid-order.server";
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

  if (intent === "start-processing") {
    if (!canStartProcessing(order.status)) {
      return { error: "Only received orders can be moved to processing." };
    }

    await db.order.update({
      where: { id: params.id },
      data: { status: "processing" },
    });

    return redirect(`/admin/orders/${params.id}`);
  }

  if (intent === "fulfill") {
    if (!canFulfillWithCode(order.status)) {
      return { error: "Only processing orders can be fulfilled with a delivery code." };
    }

    const entered = String(formData.get("deliveryCode") ?? "").trim();
    if (!order.deliveryCode) {
      return { error: "This order has no delivery code. Ask the customer to contact support." };
    }
    if (entered !== order.deliveryCode) {
      return { error: "Delivery code does not match. Ask the customer to show their code." };
    }

    await db.order.update({
      where: { id: params.id },
      data: { status: "fulfilled", fulfilledAt: new Date() },
    });

    return redirect(`/admin/orders/${params.id}`);
  }

  if (intent === "refund") {
    if (!order.stripePaymentIntentId) {
      return { error: "No Stripe payment intent found for this order." };
    }

    if (order.stripePaymentIntentId.startsWith("pi_mock_")) {
      return {
        error: "This order used a mock payment and cannot be refunded via Stripe.",
      };
    }

    if (order.status === "refunded") {
      return { error: "Order is already refunded." };
    }

    if (order.status === "refund_initiated") {
      return { error: "Refund already initiated. Waiting for Stripe to confirm." };
    }

    if (!canInitiateRefund(order.status)) {
      return { error: "This order cannot be refunded in its current status." };
    }

    try {
      const stripe = getStripe();
      const refund = await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
      });

      await db.order.update({
        where: { id: order.id },
        data: {
          status: "refund_initiated",
          refundInitiatedAt: new Date(),
        },
      });

      // Card refunds often succeed immediately; webhook also completes idempotently.
      if (refund.status === "succeeded") {
        await applyOrderRefundSideEffects(db, order.id);
      }
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
            {new Date(order.createdAt).toLocaleString("en-CA", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "America/Halifax",
            })}{" "}
            · {order.email}
          </p>
        </div>
        <Badge
          variant={
            order.status === "fulfilled"
              ? "success"
              : order.status === "refunded"
                ? "default"
                : order.status === "refund_initiated"
                  ? "warning"
                  : "terracotta"
          }
        >
          {orderStatusLabel(order.status)}
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
            {order.tax > 0 ? (
              <div className="flex justify-between">
                <dt className="text-charcoal/60">Tax</dt>
                <dd>{formatCurrency(order.tax)}</dd>
              </div>
            ) : (
              <div className="flex justify-between">
                <dt className="text-charcoal/60">Inclusive of tax</dt>
                <dd>—</dd>
              </div>
            )}
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
            {groupOrderLines(
              order.items.map((item) => ({
                productName: item.productName,
                variantLabel: item.variantLabel,
                quantity: item.quantity,
                priceAtPurchase: item.priceAtPurchase,
              }))
            ).flatMap((group, groupIndex) => {
              if (group.kind === "bundle") {
                return [
                  <tr key={`bundle-${group.name}-${groupIndex}`} className="border-b border-charcoal/10 bg-sand/40">
                    <td className="py-2 font-medium text-navy" colSpan={3}>
                      Bundle: {group.name}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatCurrency(group.total)}
                    </td>
                  </tr>,
                  ...group.lines.map((line, lineIndex) => (
                    <tr
                      key={`bundle-line-${group.name}-${line.pieceName}-${lineIndex}`}
                      className="border-b border-charcoal/5"
                    >
                      <td className="py-2 pl-6 text-charcoal/80">{line.pieceName}</td>
                      <td className="py-2 text-charcoal/60">{line.variantLabel}</td>
                      <td className="py-2">{line.quantity}</td>
                      <td className="py-2 text-right">
                        {formatCurrency(line.priceAtPurchase)}
                      </td>
                    </tr>
                  )),
                ];
              }

              const item = order.items.find(
                (row) =>
                  row.productName === group.line.productName &&
                  row.variantLabel === group.line.variantLabel &&
                  row.quantity === group.line.quantity
              );
              return [
                <tr key={`single-${groupIndex}`} className="border-b border-charcoal/5">
                  <td className="py-2">
                    {group.line.productName}
                    {item?.lineType === "gift_card" && (
                      <Badge variant="default" className="ml-2">
                        E-gift
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 text-charcoal/60">{group.line.variantLabel}</td>
                  <td className="py-2">{group.line.quantity}</td>
                  <td className="py-2 text-right">
                    {formatCurrency(group.line.priceAtPurchase)}
                  </td>
                </tr>,
              ];
            })}
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

      <div className="flex flex-wrap items-end gap-3">
        {canStartProcessing(order.status) && (
          <Form method="post">
            <input type="hidden" name="intent" value="start-processing" />
            <Button type="submit">Start processing</Button>
          </Form>
        )}

        {canFulfillWithCode(order.status) && (
          <Form method="post" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="intent" value="fulfill" />
            <label className="block text-sm">
              <span className="mb-1 block text-charcoal/60">
                Customer delivery code
              </span>
              <input
                name="deliveryCode"
                inputMode="numeric"
                autoComplete="off"
                placeholder="6-digit code"
                className="h-10 w-40 rounded-md border border-charcoal/20 bg-white px-3 font-mono tracking-widest"
                required
              />
            </label>
            <Button type="submit">Mark fulfilled</Button>
          </Form>
        )}

        {order.stripePaymentIntentId && canInitiateRefund(order.status) && (
          <Form method="post">
            <input type="hidden" name="intent" value="refund" />
            <Button type="submit" variant="outline" className="text-red-600">
              Issue refund
            </Button>
          </Form>
        )}

        {order.status === "refund_initiated" && (
          <p className="text-sm text-charcoal/60">
            Refund initiated{order.refundInitiatedAt
              ? ` on ${new Date(order.refundInitiatedAt).toLocaleString("en-CA", {
                  timeZone: "America/Halifax",
                })}`
              : ""}
            . Waiting for Stripe confirmation.
          </p>
        )}
      </div>

      {canFulfillWithCode(order.status) && (
        <p className="text-sm text-charcoal/55">
          Ask the customer for the delivery code from their email or account. The code is not shown
          here.
        </p>
      )}
    </div>
  );
}
