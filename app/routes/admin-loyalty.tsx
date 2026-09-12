import { Form, redirect } from "react-router";
import type { Route } from "./+types/admin-loyalty";
import { Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }
  await requireAdmin(request);
  const customers = await db.customer.findMany({
    orderBy: { loyaltyPoints: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      email: true,
      loyaltyPoints: true,
      loyaltyLedger: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });
  return {
    dbAvailable: true as const,
    customers: customers.map((customer) => ({
      ...customer,
      ledger: customer.loyaltyLedger.map((entry) => ({
        id: entry.id,
        points: entry.points,
        reason: entry.reason,
        createdAt: entry.createdAt.toISOString(),
      })),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }
  await requireAdmin(request);
  const formData = await request.formData();
  const customerId = String(formData.get("customerId") ?? "");
  const points = parseInt(String(formData.get("points") ?? "0"), 10);
  const reason = String(formData.get("reason") ?? "").trim() || "Manual adjustment";

  if (!customerId || !Number.isInteger(points) || points === 0) {
    return { error: "Choose a customer and a non-zero point amount." };
  }

  await db.customer.update({
    where: { id: customerId },
    data: { loyaltyPoints: { increment: points } },
  });
  await db.loyaltyLedger.create({
    data: { customerId, points, reason },
  });
  return redirect("/admin/loyalty");
}

export default function AdminLoyalty({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-navy">Loyalty</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Customers earn 1 point per dollar spent. Adjust balances here for rewards or
          make-goods.
        </p>
      </div>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <div className="space-y-4">
        {loaderData.customers.length === 0 ? (
          <p className="text-charcoal/60">No customer accounts yet.</p>
        ) : (
          loaderData.customers.map((customer) => (
            <Card key={customer.id} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-medium text-navy">{customer.name || customer.email}</p>
                  <p className="text-sm text-charcoal/60">{customer.email}</p>
                </div>
                <p className="text-lg font-medium text-navy">{customer.loyaltyPoints} pts</p>
              </div>
              {customer.ledger.length > 0 && (
                <ul className="text-xs text-charcoal/55">
                  {customer.ledger.map((entry) => (
                    <li key={entry.id}>
                      {entry.points > 0 ? "+" : ""}
                      {entry.points} · {entry.reason}
                    </li>
                  ))}
                </ul>
              )}
              <Form method="post" className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="customerId" value={customer.id} />
                <Input name="points" label="Points" type="number" defaultValue="50" className="w-28" />
                <Input name="reason" label="Reason" placeholder="Birthday bonus" />
                <Button type="submit" size="sm">
                  Adjust
                </Button>
              </Form>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
