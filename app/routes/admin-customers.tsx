import type { Route } from "./+types/admin-customers";
import { Card } from "~/components/ui/Badge";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const customers = await db.customer.findMany({
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
  });

  return {
    dbAvailable: true as const,
    customers: customers.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      marketingOptIn: c.marketingOptIn,
      orderCount: c._count.orders,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export default function AdminCustomers({ loaderData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { customers } = loaderData;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif text-navy">Customers</h1>

      <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-charcoal/10 bg-sand/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Orders</th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Marketing</th>
              <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-charcoal/60">
                  No customers yet.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="border-b border-charcoal/5 hover:bg-sand/30">
                  <td className="px-4 py-3 font-medium text-navy">
                    {customer.name ?? "—"}
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-3">{customer.email}</td>
                  <td className="px-4 py-3">{customer.orderCount}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {customer.marketingOptIn ? "Yes" : "No"}
                  </td>
                  <td className="hidden px-4 py-3 text-charcoal/60 md:table-cell">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Card className="text-sm text-charcoal/60">
        {customers.length} customer{customers.length !== 1 ? "s" : ""} total
      </Card>
    </div>
  );
}
