import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/account-orders";
import { OrderLineGroups } from "~/components/storefront/OrderLineGroups";
import { requireCustomer } from "~/lib/session.server";
import { tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";
import { cn, formatCurrency } from "~/lib/utils";

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

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "pending", label: "Pending" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const ORDER_STATUS_STYLES: Record<string, string> = {
  paid: "bg-sky/15 text-navy",
  fulfilled: "bg-emerald-50 text-emerald-800",
  refunded: "bg-red-50 text-red-700",
  pending: "bg-sand text-charcoal/70",
  cancelled: "bg-charcoal/5 text-charcoal/55",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  fulfilled: "Fulfilled",
  refunded: "Refunded",
  pending: "Pending",
  cancelled: "Cancelled",
};

function orderStatusClass(status: string) {
  return ORDER_STATUS_STYLES[status] ?? "bg-charcoal/5 text-charcoal/60";
}

function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status;
}

function itemCount(items: { quantity: number }[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export default function AccountOrders({ loaderData }: Route.ComponentProps) {
  const { orders } = loaderData;
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "all";

  const filtered =
    statusFilter === "all" ? orders : orders.filter((order) => order.status === statusFilter);

  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
  const fulfilledCount = orders.filter((order) => order.status === "fulfilled").length;

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden bg-sand">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(29,78,120,0.08),transparent_45%),radial-gradient(ellipse_at_80%_0%,rgba(201,165,90,0.14),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent" />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <nav aria-label="Breadcrumb" className="mb-8">
          <Link
            to="/account"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-navy/70 transition-colors hover:text-navy"
          >
            <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden>
              <path
                d="M12.5 4.5 7 10l5.5 5.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Account
          </Link>
        </nav>

        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-navy/45">
              Account
            </p>
            <h1 className="mt-1 font-serif text-3xl tracking-tight text-navy sm:text-4xl">
              Order history
            </h1>
            <p className="mt-2 text-sm text-charcoal/55">
              {orders.length === 0
                ? "Your past purchases will show up here."
                : `${orders.length} order${orders.length === 1 ? "" : "s"} · ${formatCurrency(totalSpent)} spent`}
            </p>
          </div>

          {orders.length > 0 ? (
            <Link
              to="/account/profile"
              className="inline-flex min-h-11 items-center self-start rounded-full border border-navy/15 bg-white/70 px-4 text-sm font-medium text-navy transition-colors hover:border-navy/30 hover:bg-white sm:self-auto"
            >
              Profile
            </Link>
          ) : null}
        </header>

        {orders.length > 0 ? (
          <div className="mb-8 grid grid-cols-3 overflow-hidden rounded-2xl border border-charcoal/10 bg-white/80 shadow-[0_18px_40px_rgba(17,26,34,0.05)] backdrop-blur-sm">
            {[
              { label: "Orders", value: String(orders.length) },
              { label: "Fulfilled", value: String(fulfilledCount) },
              { label: "Spent", value: formatCurrency(totalSpent) },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className={cn(
                  "px-3 py-5 text-center sm:px-5 sm:py-6",
                  index > 0 && "border-l border-charcoal/8"
                )}
              >
                <p className="font-serif text-2xl tracking-tight text-navy sm:text-[1.75rem]">
                  {stat.value}
                </p>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-charcoal/45 sm:text-[11px]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-charcoal/15 bg-white/70 px-6 py-16 text-center shadow-[0_18px_40px_rgba(17,26,34,0.04)] backdrop-blur-sm">
            <div
              className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-navy/5 text-navy"
              aria-hidden
            >
              <BagIcon className="size-6" />
            </div>
            <h2 className="font-serif text-2xl text-navy">No orders yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-charcoal/60">
              When you place an order, tracking and details will live here.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-terracotta px-7 text-sm font-medium text-white transition-colors hover:bg-terracotta/90"
            >
              Shop scrubs
            </Link>
          </div>
        ) : (
          <>
            <div
              className="mb-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Filter orders by status"
            >
              {STATUS_FILTERS.map((filter) => {
                const count =
                  filter.value === "all"
                    ? orders.length
                    : orders.filter((order) => order.status === filter.value).length;
                if (filter.value !== "all" && count === 0) return null;

                const active = statusFilter === filter.value;
                const to =
                  filter.value === "all"
                    ? "/account/orders"
                    : `/account/orders?status=${filter.value}`;

                return (
                  <Link
                    key={filter.value}
                    to={to}
                    role="tab"
                    aria-selected={active}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
                      active
                        ? "bg-navy text-white"
                        : "border border-navy/12 bg-white/70 text-navy hover:border-navy/25 hover:bg-white"
                    )}
                  >
                    {filter.label}
                    <span
                      className={cn(
                        "tabular-nums text-xs",
                        active ? "text-white/70" : "text-charcoal/40"
                      )}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-charcoal/10 bg-white/80 px-6 py-12 text-center">
                <p className="text-sm text-charcoal/60">
                  No {orderStatusLabel(statusFilter).toLowerCase()} orders.
                </p>
                <Link
                  to="/account/orders"
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-navy underline-offset-4 hover:underline"
                >
                  Show all orders
                </Link>
              </div>
            ) : (
              <ul className="space-y-5">
                {filtered.map((order) => {
                  const count = itemCount(order.items);
                  const placedOn = new Date(order.createdAt).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  });

                  return (
                    <li key={order.id}>
                      <article className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white/90 shadow-[0_18px_40px_rgba(17,26,34,0.05)] backdrop-blur-sm">
                        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-charcoal/8 bg-sand/30 px-5 py-4 sm:px-6">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-medium text-charcoal">{order.orderNumber}</h2>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                                  orderStatusClass(order.status)
                                )}
                              >
                                {orderStatusLabel(order.status)}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm text-charcoal/55">
                              {placedOn}
                              <span className="mx-1.5 text-charcoal/25" aria-hidden>
                                ·
                              </span>
                              {count} item{count === 1 ? "" : "s"}
                            </p>
                          </div>
                          <p className="font-serif text-2xl tracking-tight text-navy tabular-nums">
                            {formatCurrency(order.total)}
                          </p>
                        </header>

                        <div className="px-5 py-5 sm:px-6">
                          <OrderLineGroups items={order.items} className="space-y-3" />

                          <dl className="mt-5 space-y-1.5 border-t border-charcoal/8 pt-4 text-sm">
                            <div className="flex justify-between gap-3 text-charcoal/55">
                              <dt>Subtotal</dt>
                              <dd className="tabular-nums">{formatCurrency(order.subtotal)}</dd>
                            </div>
                            <div className="flex justify-between gap-3 text-charcoal/55">
                              <dt>Shipping</dt>
                              <dd className="tabular-nums">
                                {order.shipping === 0
                                  ? "Free"
                                  : formatCurrency(order.shipping)}
                              </dd>
                            </div>
                            {order.tax > 0 ? (
                              <div className="flex justify-between gap-3 text-charcoal/55">
                                <dt>Tax</dt>
                                <dd className="tabular-nums">{formatCurrency(order.tax)}</dd>
                              </div>
                            ) : null}
                            <div className="flex justify-between gap-3 pt-1 font-medium text-navy">
                              <dt>Total</dt>
                              <dd className="tabular-nums">{formatCurrency(order.total)}</dd>
                            </div>
                          </dl>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {orders.length > 0 ? (
          <p className="mt-10 text-center text-sm text-charcoal/45">
            Need help with an order?{" "}
            <Link
              to="/contact"
              className="font-medium text-navy underline-offset-4 transition-colors hover:text-terracotta hover:underline"
            >
              Contact us
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function BagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6.5 8.5h11l-.7 10.2a1.5 1.5 0 0 1-1.5 1.4H8.7a1.5 1.5 0 0 1-1.5-1.4L6.5 8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.5V7a3 3 0 0 1 6 0v1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
