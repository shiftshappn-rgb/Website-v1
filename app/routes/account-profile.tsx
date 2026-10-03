import { Form, Link, data } from "react-router";
import type { Route } from "./+types/account-profile";
import { requireCustomer } from "~/lib/session.server";
import { tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";
import { formatCurrency } from "~/lib/utils";
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "My profile — shiftshappn",
    description: "View and manage your shiftshappn account details.",
    path: "/account/profile",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { customer } = await requireCustomer(request);
  const db = tryDb();

  if (!db) {
    return {
      profile: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        avatarUrl: customer.avatarUrl,
        usesGoogle: !!customer.googleId,
        marketingOptIn: customer.marketingOptIn,
        loyaltyPoints: customer.loyaltyPoints,
        createdAt: customer.createdAt.toISOString(),
      },
      addresses: customer.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        province: a.province,
        postalCode: a.postalCode,
        country: a.country,
        isDefault: a.isDefault,
      })),
      orderStats: { totalOrders: 0, totalSpent: 0 },
      recentOrders: [],
    };
  }

  const [orderAgg, recentOrders] = await Promise.all([
    db.order.aggregate({
      where: { customerId: customer.id },
      _count: { id: true },
      _sum: { total: true },
    }),
    db.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: true },
    }),
  ]);

  const fresh = await db.customer.findUnique({
    where: { id: customer.id },
    select: { loyaltyPoints: true },
  });

  return {
    profile: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      avatarUrl: customer.avatarUrl,
      usesGoogle: !!customer.googleId,
      marketingOptIn: customer.marketingOptIn,
      loyaltyPoints: fresh?.loyaltyPoints ?? customer.loyaltyPoints,
      createdAt: customer.createdAt.toISOString(),
    },
    addresses: customer.addresses.map((a) => ({
      id: a.id,
      label: a.label,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      province: a.province,
      postalCode: a.postalCode,
      country: a.country,
      isDefault: a.isDefault,
    })),
    orderStats: {
      totalOrders: orderAgg._count.id,
      totalSpent: Number(orderAgg._sum.total ?? 0),
    },
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { customer } = await requireCustomer(request);
  const db = tryDb();
  if (!db) {
    return data({ error: "Database unavailable." }, { status: 503 });
  }

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const marketingOptIn = formData.get("marketingOptIn") === "on";

  await db.customer.update({
    where: { id: customer.id },
    data: {
      name: name || null,
      marketingOptIn,
    },
  });

  return { success: true };
}

export default function AccountProfile({ loaderData, actionData }: Route.ComponentProps) {
  const { profile, addresses, orderStats, recentOrders } = loaderData;
  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <p className="mb-4 text-sm">
        <Link to="/account" className="text-navy hover:text-terracotta">
          ← Account
        </Link>
      </p>

      <div className="mb-8 flex items-center gap-4">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt=""
            className="size-16 rounded-full object-cover border border-charcoal/10"
          />
        ) : (
          <div className="size-16 rounded-full bg-navy text-white flex items-center justify-center text-xl font-semibold">
            {(profile.name || profile.email)[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-serif text-3xl text-navy mb-1">My profile</h1>
          <p className="text-charcoal/70">Member since {memberSince}</p>
          {profile.usesGoogle && (
            <p className="mt-1 text-xs text-charcoal/50">Signed in with Google</p>
          )}
        </div>
      </div>

      {actionData && "success" in actionData && actionData.success && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Profile updated successfully.
        </div>
      )}
      {actionData && "error" in actionData && actionData.error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionData.error}
        </div>
      )}

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        {[
          { label: "Orders", value: String(orderStats.totalOrders) },
          { label: "Total spent", value: formatCurrency(orderStats.totalSpent) },
          { label: "Loyalty points", value: String(profile.loyaltyPoints) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-charcoal/10 bg-white p-4 text-center"
          >
            <p className="text-2xl font-semibold text-navy">{stat.value}</p>
            <p className="mt-1 text-xs text-charcoal/60 uppercase tracking-wide">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Personal info */}
      <section className="mb-8 rounded-xl border border-charcoal/10 bg-white p-6">
        <h2 className="font-serif text-xl text-navy mb-4">Personal information</h2>
        <Form method="post" className="space-y-5">
          <Input
            label="Full name"
            name="name"
            type="text"
            defaultValue={profile.name ?? ""}
            autoComplete="name"
            placeholder="Your name"
          />
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1.5">Email</label>
            <p className="rounded-lg border border-charcoal/10 bg-stone/30 px-4 py-2.5 text-sm text-charcoal/70">
              {profile.email}
            </p>
            <p className="mt-1 text-xs text-charcoal/50">Email cannot be changed here.</p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="marketingOptIn"
              defaultChecked={profile.marketingOptIn}
              className="mt-1 size-4 rounded border-charcoal/30 text-navy focus:ring-navy"
            />
            <span className="text-sm text-charcoal/80">
              Send me emails about new products, offers, and shiftshappn news.
            </span>
          </label>
          <Button type="submit" variant="terracotta">
            Save changes
          </Button>
        </Form>
      </section>

      {/* Saved addresses */}
      <section className="mb-8 rounded-xl border border-charcoal/10 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl text-navy">Saved addresses</h2>
          <Link
            to="/account/addresses"
            className="text-sm text-navy underline underline-offset-4 hover:text-terracotta"
          >
            Manage
          </Link>
        </div>
        {addresses.length === 0 ? (
          <p className="text-sm text-charcoal/60">
            No saved addresses yet.{" "}
            <Link to="/account/addresses" className="text-navy underline underline-offset-2">
              Add one
            </Link>
          </p>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="rounded-lg border border-charcoal/10 px-4 py-3 text-sm"
              >
                <p className="font-medium text-charcoal">
                  {addr.label || "Address"}
                  {addr.isDefault && (
                    <span className="ml-2 text-xs uppercase tracking-wide text-emerald-700">
                      Default
                    </span>
                  )}
                </p>
                <p className="mt-1 text-charcoal/70">
                  {addr.line1}
                  {addr.line2 ? `, ${addr.line2}` : ""}
                </p>
                <p className="text-charcoal/70">
                  {addr.city}, {addr.province} {addr.postalCode}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent orders */}
      <section className="rounded-xl border border-charcoal/10 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl text-navy">Recent orders</h2>
          <Link
            to="/account/orders"
            className="text-sm text-navy underline underline-offset-4 hover:text-terracotta"
          >
            View all
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-charcoal/60">No orders yet.</p>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                to="/account/orders"
                className="flex items-center justify-between rounded-lg border border-charcoal/10 px-4 py-3 hover:border-navy/20 transition-colors"
              >
                <div>
                  <p className="font-medium text-charcoal">{order.orderNumber}</p>
                  <p className="text-xs text-charcoal/60">
                    {new Date(order.createdAt).toLocaleDateString("en-CA")} · {order.itemCount}{" "}
                    item{order.itemCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-navy">{formatCurrency(order.total)}</p>
                  <p className="text-xs capitalize text-charcoal/50">{order.status}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
