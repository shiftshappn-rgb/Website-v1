import { Form, Link, data, useNavigation } from "react-router";
import type { Route } from "./+types/account-profile";
import { requireCustomer } from "~/lib/session.server";
import { tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";
import { cn, formatCurrency } from "~/lib/utils";
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

const ORDER_STATUS_STYLES: Record<string, string> = {
  paid: "bg-sky/15 text-navy",
  fulfilled: "bg-emerald-50 text-emerald-800",
  refunded: "bg-red-50 text-red-700",
  pending: "bg-sand text-charcoal/70",
  cancelled: "bg-charcoal/5 text-charcoal/55",
};

function orderStatusClass(status: string) {
  return ORDER_STATUS_STYLES[status] ?? "bg-charcoal/5 text-charcoal/60";
}

function initials(name: string | null, email: string) {
  const source = (name || email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (source[0] ?? "?").toUpperCase();
}

export default function AccountProfile({ loaderData, actionData }: Route.ComponentProps) {
  const { profile, addresses, orderStats, recentOrders } = loaderData;
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const displayName = profile.name?.trim() || profile.email.split("@")[0] || "there";
  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
  });

  const stats = [
    { label: "Orders", value: String(orderStats.totalOrders), href: "/account/orders" },
    { label: "Spent", value: formatCurrency(orderStats.totalSpent), href: "/account/orders" },
    { label: "Points", value: String(profile.loyaltyPoints), href: "/account/rewards" },
  ] as const;

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden bg-sand">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(29,78,120,0.08),transparent_45%),radial-gradient(ellipse_at_80%_0%,rgba(201,165,90,0.14),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent" />

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
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

        {/* Identity */}
        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4 sm:gap-5">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                width={88}
                height={88}
                className="size-[4.5rem] shrink-0 rounded-full object-cover ring-2 ring-gold/50 ring-offset-2 ring-offset-sand sm:size-[5.5rem]"
              />
            ) : (
              <div
                className="flex size-[4.5rem] shrink-0 items-center justify-center rounded-full bg-navy font-serif text-2xl text-gold ring-2 ring-gold/40 ring-offset-2 ring-offset-sand sm:size-[5.5rem] sm:text-3xl"
                aria-hidden
              >
                {initials(profile.name, profile.email)}
              </div>
            )}

            <div className="min-w-0 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-navy/45">
                Profile
              </p>
              <h1 className="mt-1 truncate font-serif text-3xl tracking-tight text-navy sm:text-4xl lg:text-[2.75rem]">
                {displayName}
              </h1>
              <p className="mt-2 text-sm text-charcoal/60">
                Member since {memberSince}
                {profile.usesGoogle ? (
                  <>
                    <span className="mx-2 text-charcoal/25" aria-hidden>
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <GoogleGlyph />
                      Google account
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Link
              to="/account/orders"
              className="inline-flex min-h-11 items-center rounded-full border border-navy/15 bg-white/70 px-4 text-sm font-medium text-navy transition-colors hover:border-navy/30 hover:bg-white"
            >
              Orders
            </Link>
            <Link
              to="/account/rewards"
              className="inline-flex min-h-11 items-center rounded-full border border-navy/15 bg-white/70 px-4 text-sm font-medium text-navy transition-colors hover:border-navy/30 hover:bg-white"
            >
              Rewards
            </Link>
            <Link
              to="/account/addresses"
              className="inline-flex min-h-11 items-center rounded-full bg-navy px-4 text-sm font-medium text-white transition-colors hover:bg-navy/90"
            >
              Addresses
            </Link>
          </div>
        </header>

        {/* Stats strip */}
        <div className="mb-10 grid grid-cols-3 overflow-hidden rounded-2xl border border-charcoal/10 bg-white/80 shadow-[0_18px_40px_rgba(17,26,34,0.05)] backdrop-blur-sm">
          {stats.map((stat, index) => (
            <Link
              key={stat.label}
              to={stat.href}
              className={cn(
                "group relative px-3 py-5 text-center transition-colors hover:bg-sand/40 sm:px-6 sm:py-6",
                index > 0 && "border-l border-charcoal/8"
              )}
            >
              <p className="font-serif text-2xl tracking-tight text-navy sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-charcoal/45 sm:text-[11px]">
                {stat.label}
              </p>
            </Link>
          ))}
        </div>

        {actionData && "success" in actionData && actionData.success ? (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3.5 text-sm text-emerald-900"
          >
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-700" />
            <span>Profile updated. Your details are saved.</span>
          </div>
        ) : null}
        {actionData && "error" in actionData && actionData.error ? (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-800"
          >
            {actionData.error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-8">
          {/* Personal info */}
          <section className="rounded-2xl border border-charcoal/10 bg-white/90 p-6 shadow-[0_18px_40px_rgba(17,26,34,0.05)] backdrop-blur-sm sm:p-8">
            <div className="mb-6">
              <h2 className="font-serif text-2xl tracking-tight text-navy">Personal information</h2>
              <p className="mt-1.5 text-sm text-charcoal/55">
                Used for checkout and order updates.
              </p>
            </div>

            <Form method="post" className="space-y-6">
              <div className="space-y-1.5">
                <label htmlFor="profile-name" className="block text-sm font-medium text-charcoal">
                  Full name
                </label>
                <input
                  id="profile-name"
                  name="name"
                  type="text"
                  defaultValue={profile.name ?? ""}
                  autoComplete="name"
                  placeholder="Your name"
                  className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 text-base text-charcoal placeholder:text-charcoal/35 transition-[border-color,box-shadow] focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="profile-email" className="block text-sm font-medium text-charcoal">
                  Email
                </label>
                <div
                  id="profile-email"
                  className="rounded-xl border border-charcoal/10 bg-sand/50 px-4 py-3 text-base text-charcoal/70"
                >
                  {profile.email}
                </div>
                <p className="text-xs text-charcoal/45">
                  Email is tied to sign-in and can’t be changed here.
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-charcoal/10 bg-sand/30 p-4 transition-colors hover:border-navy/20 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy/25">
                <input
                  type="checkbox"
                  name="marketingOptIn"
                  defaultChecked={profile.marketingOptIn}
                  className="mt-1 size-4 rounded border-charcoal/30 text-navy focus:ring-navy"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-charcoal">Email updates</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-charcoal/60">
                    New drops, offers, and shiftshappn news. Unsubscribe anytime.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button type="submit" variant="terracotta" size="lg" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save changes"}
                </Button>
                <Link
                  to="/account"
                  className="inline-flex min-h-12 items-center px-2 text-sm text-charcoal/55 transition-colors hover:text-navy"
                >
                  Cancel
                </Link>
              </div>
            </Form>
          </section>

          <div className="space-y-6">
            {/* Addresses */}
            <section className="rounded-2xl border border-charcoal/10 bg-white/90 p-6 shadow-[0_18px_40px_rgba(17,26,34,0.05)] backdrop-blur-sm sm:p-7">
              <div className="mb-5 flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl tracking-tight text-navy">Saved addresses</h2>
                <Link
                  to="/account/addresses"
                  className="text-sm font-medium text-navy underline-offset-4 transition-colors hover:text-terracotta hover:underline"
                >
                  Manage
                </Link>
              </div>

              {addresses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-charcoal/15 bg-sand/40 px-4 py-8 text-center">
                  <p className="text-sm text-charcoal/60">No addresses yet.</p>
                  <Link
                    to="/account/addresses"
                    className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-navy underline-offset-4 hover:underline"
                  >
                    Add an address
                  </Link>
                </div>
              ) : (
                <ul className="space-y-3">
                  {addresses.slice(0, 3).map((addr) => (
                    <li
                      key={addr.id}
                      className="rounded-xl border border-charcoal/8 bg-sand/25 px-4 py-3.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-charcoal">{addr.label || "Address"}</p>
                        {addr.isDefault ? (
                          <span className="rounded-full bg-navy/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy">
                            Default
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 leading-relaxed text-charcoal/65">
                        {addr.line1}
                        {addr.line2 ? `, ${addr.line2}` : ""}
                        <br />
                        {addr.city}, {addr.province} {addr.postalCode}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recent orders */}
            <section className="rounded-2xl border border-charcoal/10 bg-white/90 p-6 shadow-[0_18px_40px_rgba(17,26,34,0.05)] backdrop-blur-sm sm:p-7">
              <div className="mb-5 flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl tracking-tight text-navy">Recent orders</h2>
                <Link
                  to="/account/orders"
                  className="text-sm font-medium text-navy underline-offset-4 transition-colors hover:text-terracotta hover:underline"
                >
                  View all
                </Link>
              </div>

              {recentOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-charcoal/15 bg-sand/40 px-4 py-8 text-center">
                  <p className="text-sm text-charcoal/60">No orders yet.</p>
                  <Link
                    to="/shop"
                    className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-navy underline-offset-4 hover:underline"
                  >
                    Shop scrubs
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-charcoal/8">
                  {recentOrders.map((order) => (
                    <li key={order.id}>
                      <Link
                        to="/account/orders"
                        className="flex items-center justify-between gap-3 py-3.5 transition-colors first:pt-0 last:pb-0 hover:text-navy"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-charcoal">{order.orderNumber}</p>
                          <p className="mt-0.5 text-xs text-charcoal/50">
                            {new Date(order.createdAt).toLocaleDateString("en-CA")} ·{" "}
                            {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-medium tabular-nums text-navy">
                            {formatCurrency(order.total)}
                          </p>
                          <span
                            className={cn(
                              "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                              orderStatusClass(order.status)
                            )}
                          >
                            {order.status}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="size-3.5" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M4.5 10.5 8 14l7.5-8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
