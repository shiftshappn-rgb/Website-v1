import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/admin-orders-index";
import { Badge, Card } from "~/components/ui/Badge";
import { Input, Select } from "~/components/ui/Input";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { formatCurrency } from "~/lib/utils";
import { requireAdmin } from "~/lib/session.server";
import type { OrderStatus } from "@prisma/client";

const statusVariant: Record<OrderStatus, "default" | "success" | "warning" | "error" | "terracotta"> = {
  pending: "warning",
  paid: "terracotta",
  fulfilled: "success",
  refunded: "default",
  cancelled: "error",
};

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status") as OrderStatus | null;

  const orders = await db.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return {
    dbAvailable: true as const,
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      email: o.email,
      status: o.status,
      total: Number(o.total),
      itemCount: o._count.items,
      createdAt: o.createdAt.toISOString(),
    })),
    search,
    statusFilter: status ?? "",
  };
}

export default function AdminOrdersIndex({ loaderData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();

  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { orders, search, statusFilter } = loaderData;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif text-navy">Orders</h1>

      <Card className="p-4">
        <form method="get" className="flex flex-wrap gap-3">
          <Input
            name="q"
            placeholder="Search by order # or email..."
            defaultValue={search}
            className="min-w-[200px] flex-1"
          />
          <Select name="status" defaultValue={statusFilter} className="w-40">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <button
            type="submit"
            className="rounded-full bg-navy px-5 py-2 text-sm text-white hover:bg-navy/90"
          >
            Filter
          </button>
          {(searchParams.get("q") || searchParams.get("status")) && (
            <Link to="/admin/orders" className="self-center text-sm text-charcoal/60 hover:text-navy">
              Clear
            </Link>
          )}
        </form>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-charcoal/10 bg-sand/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Order</th>
              <th className="px-4 py-3 text-left font-medium">Customer</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Items</th>
              <th className="px-4 py-3 text-left font-medium">Total</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-charcoal/60">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-charcoal/5 hover:bg-sand/30">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="font-medium text-navy hover:text-terracotta"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{order.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[order.status]}>{order.status}</Badge>
                  </td>
                  <td className="px-4 py-3">{order.itemCount}</td>
                  <td className="px-4 py-3">{formatCurrency(order.total)}</td>
                  <td className="px-4 py-3 text-charcoal/60">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
