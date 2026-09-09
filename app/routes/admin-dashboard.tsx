import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  Package,
  ShoppingBag,
  Store,
  TicketPercent,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import type { Route } from "./+types/admin-dashboard";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { Badge, Card } from "~/components/ui/Badge";
import { LinkButton } from "~/components/ui/Button";
import { db, isDatabaseAvailable } from "~/db.server";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { requireAdmin } from "~/lib/session.server";
import { formatCurrency, parseVariantImages } from "~/lib/utils";
import type { OrderStatus, ProductStatus } from "@prisma/client";

const paidStatuses = ["paid", "fulfilled"] as const;

const orderStatusVariant: Record<
  OrderStatus,
  "default" | "success" | "warning" | "error" | "terracotta"
> = {
  pending: "warning",
  paid: "terracotta",
  fulfilled: "success",
  refunded: "default",
  cancelled: "error",
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function dayKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const chartStart = startOfDay(new Date(now));
  chartStart.setDate(chartStart.getDate() - 6);

  const [
    chartOrders,
    recentOrders,
    topSold,
    awaitingFulfillment,
    productCounts,
    customerCount,
    pendingReviews,
    lowStock,
  ] = await Promise.all([
    db.order.findMany({
      where: { status: { in: [...paidStatuses] }, createdAt: { gte: chartStart } },
      select: { total: true, createdAt: true },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { _count: { select: { items: true } } },
    }),
    db.orderItem.groupBy({
      by: ["productName"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    db.order.count({ where: { status: "paid" } }),
    db.product.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.customer.count(),
    db.review.count({ where: { status: "pending" } }),
    db.productVariant.findMany({
      where: { inventoryQty: { lte: 10 } },
      include: { product: { select: { id: true, name: true } } },
      orderBy: { inventoryQty: "asc" },
      take: 8,
    }),
  ]);

  const topNames = topSold.map((row) => row.productName);
  const topProductRows =
    topNames.length === 0
      ? []
      : await db.product.findMany({
          where: { name: { in: topNames } },
          select: {
            id: true,
            name: true,
            variants: { select: { images: true }, take: 4 },
          },
        });

  const todayOrders = chartOrders.filter((order) => order.createdAt >= todayStart);
  const weekOrders = chartOrders.filter((order) => order.createdAt >= weekStart);
  const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const weekRevenue = weekOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const weekOrderCount = weekOrders.length;
  const averageOrderValue = weekOrderCount > 0 ? weekRevenue / weekOrderCount : 0;

  const productsByStatus = Object.fromEntries(
    productCounts.map((row) => [row.status, row._count._all])
  ) as Partial<Record<ProductStatus, number>>;
  const activeProducts = productsByStatus.active ?? 0;
  const draftProducts = productsByStatus.draft ?? 0;
  const catalogSize = productCounts.reduce((sum, row) => sum + row._count._all, 0);

  const salesByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(chartStart);
    date.setDate(chartStart.getDate() + index);
    const key = dayKey(date);
    const revenue = chartOrders
      .filter((order) => dayKey(order.createdAt) === key)
      .reduce((sum, order) => sum + Number(order.total), 0);
    return {
      key,
      label: date.toLocaleDateString("en-CA", { weekday: "short" }),
      revenue,
    };
  });

  const topProducts = topSold.map((row) => {
    const product = topProductRows.find((item) => item.name === row.productName);
    let imagePublicId: string | null = null;
    if (product) {
      for (const variant of product.variants) {
        const image = parseVariantImages(variant.images)[0];
        if (image) {
          imagePublicId = image.publicId;
          break;
        }
      }
    }
    return {
      name: row.productName,
      quantity: row._sum.quantity ?? 0,
      productId: product?.id ?? null,
      imagePublicId,
    };
  });

  return {
    dbAvailable: true as const,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? null,
    generatedAt: now.toISOString(),
    stats: {
      todayRevenue,
      todayOrderCount: todayOrders.length,
      weekRevenue,
      weekOrderCount,
      averageOrderValue,
      awaitingFulfillment,
      activeProducts,
      draftProducts,
      catalogSize,
      customerCount,
      pendingReviews,
      lowStockCount: lowStock.length,
    },
    salesByDay,
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      status: order.status,
      total: Number(order.total),
      itemCount: order._count.items,
      createdAt: order.createdAt.toISOString(),
    })),
    topProducts,
    lowStockVariants: lowStock.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      inventoryQty: variant.inventoryQty,
      productId: variant.product.id,
      productName: variant.product.name,
      label: `${variant.colorName} / ${variant.size}`,
    })),
  };
}

export default function AdminDashboard({ loaderData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { stats, salesByDay, recentOrders, topProducts, lowStockVariants, cloudName, generatedAt } =
    loaderData;
  const peakSales = Math.max(...salesByDay.map((day) => day.revenue), 1);
  const maxSold = Math.max(...topProducts.map((product) => product.quantity), 1);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Store ops</p>
          <h1 className="mt-1 font-serif text-3xl text-navy">Dashboard</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            {new Date(generatedAt).toLocaleDateString("en-CA", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            {" · "}This week vs the sales floor
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/admin/orders" variant="outline" size="sm">
            View orders
          </LinkButton>
          <LinkButton href="/admin/products/new" size="sm">
            New product
          </LinkButton>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Week sales"
          value={formatCurrency(stats.weekRevenue)}
          hint={`${stats.todayOrderCount} paid today · ${formatCurrency(stats.todayRevenue)}`}
        />
        <KpiCard
          label="Week orders"
          value={String(stats.weekOrderCount)}
          hint={`AOV ${formatCurrency(stats.averageOrderValue)}`}
        />
        <KpiCard
          label="To fulfill"
          value={String(stats.awaitingFulfillment)}
          hint="Paid, not yet shipped"
          tone={stats.awaitingFulfillment > 0 ? "alert" : "ok"}
        />
        <KpiCard
          label="Catalog"
          value={String(stats.activeProducts)}
          hint={`${stats.draftProducts} draft · ${stats.lowStockCount} low-stock SKUs`}
          tone={stats.lowStockCount > 0 ? "warn" : "ok"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg text-navy">Sales this week</h2>
              <p className="text-sm text-charcoal/55">Paid and fulfilled orders, last 7 days</p>
            </div>
            <span className="tabular-nums text-sm font-medium text-navy">
              {formatCurrency(stats.weekRevenue)}
            </span>
          </div>
          <div
            className="flex h-40 items-end gap-2"
            role="img"
            aria-label="Daily sales for the last seven days"
          >
            {salesByDay.map((day) => {
              const height = Math.max(8, Math.round((day.revenue / peakSales) * 100));
              return (
                <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-32 w-full items-end rounded-md bg-sand/80">
                    <div
                      className="w-full rounded-md bg-navy"
                      style={{ height: `${height}%` }}
                      title={`${day.label}: ${formatCurrency(day.revenue)}`}
                    />
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-charcoal/50">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-serif text-lg text-navy">Needs attention</h2>
          <ul className="divide-y divide-charcoal/10">
            <AttentionRow
              href="/admin/orders?status=paid"
              icon={<ClipboardList className="size-4" aria-hidden />}
              label="Orders to fulfill"
              value={stats.awaitingFulfillment}
              urgent={stats.awaitingFulfillment > 0}
            />
            <AttentionRow
              href="/admin/products"
              icon={<AlertTriangle className="size-4" aria-hidden />}
              label="Low-stock SKUs"
              value={stats.lowStockCount}
              urgent={stats.lowStockCount > 0}
            />
            <AttentionRow
              href="/admin/reviews"
              icon={<ShoppingBag className="size-4" aria-hidden />}
              label="Reviews waiting"
              value={stats.pendingReviews}
              urgent={stats.pendingReviews > 0}
            />
            <AttentionRow
              href="/admin/products"
              icon={<Package className="size-4" aria-hidden />}
              label="Draft products"
              value={stats.draftProducts}
              urgent={false}
            />
          </ul>
          <p className="text-xs text-charcoal/45">
            {stats.customerCount} customers on file · {stats.catalogSize} products in catalog
          </p>
        </Card>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-charcoal/10 px-6 py-4">
          <h2 className="font-serif text-lg text-navy">Recent orders</h2>
          <Link to="/admin/orders" prefetch="intent" className="inline-flex items-center gap-1 text-sm text-navy hover:text-terracotta">
            All orders
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="px-6 py-10 text-sm text-charcoal/60">No orders yet. They’ll land here as soon as checkout completes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sand/50 text-left text-xs uppercase tracking-wide text-charcoal/50">
                <tr>
                  <th className="px-4 py-3 font-medium md:px-6">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Items</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium md:px-6">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-t border-charcoal/5 hover:bg-sand/30">
                    <td className="px-4 py-3 md:px-6">
                      <Link to={`/admin/orders/${order.id}`} prefetch="intent" className="font-medium text-navy hover:text-terracotta">
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-charcoal/45">
                        {new Date(order.createdAt).toLocaleString("en-CA", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-charcoal/80">{order.email}</td>
                    <td className="hidden px-4 py-3 tabular-nums text-charcoal/70 md:table-cell">{order.itemCount}</td>
                    <td className="px-4 py-3">
                      <Badge variant={orderStatusVariant[order.status]}>{order.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-navy md:px-6">
                      {formatCurrency(order.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-lg text-navy">Best sellers</h2>
            <Link to="/admin/products" prefetch="intent" className="text-sm text-navy hover:text-terracotta">
              Catalog
            </Link>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-charcoal/60">No paid units yet.</p>
          ) : (
            <ol className="space-y-3">
              {topProducts.map((product, index) => {
                const thumb = cloudinaryImageUrl(product.imagePublicId ?? "", cloudName, 80);
                const width = Math.max(12, Math.round((product.quantity / maxSold) * 100));
                return (
                  <li key={product.name} className="flex items-center gap-3">
                    {thumb ? (
                      <img src={thumb} alt="" className="size-11 rounded-md object-cover" />
                    ) : (
                      <div className="flex size-11 items-center justify-center rounded-md bg-sand text-xs text-charcoal/40">
                        {index + 1}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {product.productId ? (
                        <Link
                          to={`/admin/products/${product.productId}`}
                          prefetch="intent"
                          className="truncate font-medium text-navy hover:text-terracotta"
                        >
                          {product.name}
                        </Link>
                      ) : (
                        <p className="truncate font-medium text-navy">{product.name}</p>
                      )}
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand">
                        <div className="h-full rounded-full bg-terracotta" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                    <Badge variant="terracotta">{product.quantity} sold</Badge>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-lg text-navy">Inventory watch</h2>
            <Link to="/admin/products" prefetch="intent" className="text-sm text-navy hover:text-terracotta">
              Restock
            </Link>
          </div>
          {lowStockVariants.length === 0 ? (
            <p className="text-sm text-charcoal/60">All tracked SKUs are above the low-stock threshold.</p>
          ) : (
            <ul className="space-y-3">
              {lowStockVariants.map((variant) => (
                <li key={variant.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <Link
                      to={`/admin/products/${variant.productId}`}
                      prefetch="intent"
                      className="font-medium text-navy hover:text-terracotta"
                    >
                      {variant.productName}
                    </Link>
                    <p className="truncate text-xs text-charcoal/50">
                      {variant.label} · {variant.sku}
                    </p>
                  </div>
                  <Badge variant={variant.inventoryQty === 0 ? "error" : "warning"}>
                    {variant.inventoryQty === 0 ? "Sold out" : `${variant.inventoryQty} left`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <QuickLink href="/admin/products" icon={<Package className="size-4" />} label="Products" />
        <QuickLink href="/admin/orders" icon={<ClipboardList className="size-4" />} label="Orders" />
        <QuickLink href="/admin/customers" icon={<Users className="size-4" />} label="Customers" />
        <QuickLink href="/admin/discounts" icon={<TicketPercent className="size-4" />} label="Discounts" />
        <QuickLink href="/" icon={<Store className="size-4" />} label="Storefront" external />
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "alert" | "warn" | "ok";
}) {
  return (
    <Card className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-charcoal/50">{label}</p>
      <p className="font-serif text-3xl tabular-nums text-navy">{value}</p>
      <p
        className={
          tone === "alert"
            ? "text-sm text-terracotta"
            : tone === "warn"
              ? "text-sm text-charcoal/70"
              : "text-sm text-charcoal/55"
        }
      >
        {hint}
      </p>
    </Card>
  );
}

function AttentionRow({
  href,
  icon,
  label,
  value,
  urgent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  urgent: boolean;
}) {
  return (
    <li>
      <Link
        to={href}
        prefetch="intent"
        className="flex min-h-11 items-center justify-between gap-3 py-2.5 text-sm hover:text-terracotta"
      >
        <span className="inline-flex items-center gap-2 text-navy">
          {icon}
          {label}
        </span>
        <span className={urgent ? "tabular-nums font-semibold text-terracotta" : "tabular-nums text-charcoal/60"}>
          {value}
        </span>
      </Link>
    </li>
  );
}

function QuickLink({
  href,
  icon,
  label,
  external = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  const className =
    "inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border border-charcoal/10 bg-white px-4 text-sm font-medium text-navy hover:border-navy/30 hover:bg-sand/40";

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
        <ArrowUpRight className="size-3.5" aria-hidden />
      </a>
    );
  }

  return (
    <Link to={href} prefetch="intent" className={className}>
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ArrowUpRight className="size-3.5" aria-hidden />
    </Link>
  );
}
