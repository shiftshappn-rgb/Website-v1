import { Link } from "react-router";
import type { Route } from "./+types/account-orders";
import { requireCustomer } from "~/lib/session.server";
import { tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";
import { formatCurrency } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Order history — shiftshappn",
    description: "View your shiftshappn order history.",
    path: "/account/orders",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { customer } = await requireCustomer(request);
  const db = tryDb();

  const orders = db
    ? await db.order.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        include: { items: true },
      })
    : [];

  return {
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      shipping: Number(order.shipping),
      tax: Number(order.tax),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        productName: item.productName,
        variantLabel: item.variantLabel,
        quantity: item.quantity,
        priceAtPurchase: Number(item.priceAtPurchase),
      })),
    })),
  };
}

export default function AccountOrders({ loaderData }: Route.ComponentProps) {
  const { orders } = loaderData;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <Link
        to="/account"
        className="text-sm text-navy hover:text-terracotta transition-colors"
      >
        ← Back to account
      </Link>

      <h1 className="text-3xl lg:text-4xl font-serif text-navy mt-4 mb-8">Order history</h1>

      {orders.length === 0 ? (
        <p className="text-charcoal/60 py-12 text-center">No orders yet.</p>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <article
              key={order.id}
              className="p-6 rounded-xl border border-charcoal/10 bg-white"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <p className="font-medium text-charcoal">{order.orderNumber}</p>
                  <p className="text-sm text-charcoal/60">
                    {new Date(order.createdAt).toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-navy">{formatCurrency(order.total)}</p>
                  <p className="text-xs text-charcoal/50 capitalize">{order.status}</p>
                </div>
              </div>

              <ul className="space-y-2 border-t border-charcoal/10 pt-4">
                {order.items.map((item, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="text-charcoal/80">
                      {item.productName} — {item.variantLabel} × {item.quantity}
                    </span>
                    <span className="text-charcoal/60">
                      {formatCurrency(item.priceAtPurchase * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
