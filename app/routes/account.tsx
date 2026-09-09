import { Link } from "react-router";
import type { Route } from "./+types/account";
import { requireCustomer } from "~/lib/session.server";
import { tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";
import { formatCurrency } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "My account — shiftshappn",
    description: "Manage your shiftshappn account, orders, and addresses.",
    path: "/account",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { customer } = await requireCustomer(request);
  const db = tryDb();

  const recentOrders = db
    ? await db.order.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 3,
      })
    : [];

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      marketingOptIn: customer.marketingOptIn,
      addressCount: customer.addresses.length,
    },
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}

export default function Account({ loaderData }: Route.ComponentProps) {
  const { customer, recentOrders } = loaderData;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <h1 className="text-3xl lg:text-4xl font-serif text-navy mb-2">
        Hello{customer.name ? `, ${customer.name}` : ""}
      </h1>
      <p className="text-charcoal/70 mb-10">{customer.email}</p>

      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        <Link
          to="/account/orders"
          className="p-6 rounded-xl border border-charcoal/10 bg-white hover:border-navy/30 transition-colors"
        >
          <h2 className="font-serif text-lg text-navy">Orders</h2>
          <p className="mt-1 text-sm text-charcoal/60">View order history</p>
        </Link>
        <Link
          to="/account/addresses"
          className="p-6 rounded-xl border border-charcoal/10 bg-white hover:border-navy/30 transition-colors"
        >
          <h2 className="font-serif text-lg text-navy">Addresses</h2>
          <p className="mt-1 text-sm text-charcoal/60">
            {customer.addressCount} saved address{customer.addressCount !== 1 ? "es" : ""}
          </p>
        </Link>
      </div>

      {recentOrders.length > 0 && (
        <section>
          <h2 className="text-xl font-serif text-navy mb-4">Recent orders</h2>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                to="/account/orders"
                className="flex items-center justify-between p-4 rounded-lg border border-charcoal/10 bg-white hover:border-navy/20 transition-colors"
              >
                <div>
                  <p className="font-medium text-charcoal">{order.orderNumber}</p>
                  <p className="text-sm text-charcoal/60">
                    {new Date(order.createdAt).toLocaleDateString("en-CA")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-navy">{formatCurrency(order.total)}</p>
                  <p className="text-xs text-charcoal/50 capitalize">{order.status}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <form action="/auth/logout" method="post" className="mt-12">
        <button
          type="submit"
          className="text-sm text-charcoal/60 hover:text-red-600 transition-colors"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
