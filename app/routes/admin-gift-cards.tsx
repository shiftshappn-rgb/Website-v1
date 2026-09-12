import { Form, redirect } from "react-router";
import type { Route } from "./+types/admin-gift-cards";
import { Badge, Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { generateGiftCardCode } from "~/lib/commerce.server";
import { requireAdmin } from "~/lib/session.server";
import { formatCurrency } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }
  await requireAdmin(request);
  const cards = await db.giftCard.findMany({ orderBy: { createdAt: "desc" } });
  return {
    dbAvailable: true as const,
    cards: cards.map((card) => ({
      id: card.id,
      code: card.code,
      initialAmount: Number(card.initialAmount),
      balance: Number(card.balance),
      recipientEmail: card.recipientEmail,
      note: card.note,
      status: card.status,
      createdAt: card.createdAt.toISOString(),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "create");

  if (intent === "disable") {
    await db.giftCard.update({
      where: { id: String(formData.get("id") ?? "") },
      data: { status: "disabled" },
    });
    return redirect("/admin/gift-cards");
  }

  const amount = parseFloat(String(formData.get("amount") ?? "0"));
  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const code = String(formData.get("code") ?? "").trim().toUpperCase() || generateGiftCardCode();

  if (!Number.isFinite(amount) || amount < 10) {
    return { error: "Gift cards must be at least $10." };
  }

  const existing = await db.giftCard.findUnique({ where: { code } });
  if (existing) {
    return { error: "That gift card code already exists." };
  }

  await db.giftCard.create({
    data: {
      code,
      initialAmount: amount,
      balance: amount,
      recipientEmail,
      note,
    },
  });
  return redirect("/admin/gift-cards");
}

export default function AdminGiftCards({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-navy">Gift cards</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Issue a code and the customer can redeem it in the cart.
        </p>
      </div>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <Card>
        <h2 className="mb-4 font-medium text-navy">Issue gift card</h2>
        <Form method="post" className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="intent" value="create" />
          <Input label="Amount (CAD)" name="amount" type="number" step="1" min="10" required defaultValue="50" />
          <Input label="Code" name="code" placeholder="Leave blank to generate" />
          <Input label="Recipient email" name="recipientEmail" type="email" />
          <Input label="Note" name="note" placeholder="Birthday, staff gift…" />
          <div className="sm:col-span-2">
            <Button type="submit">Issue card</Button>
          </div>
        </Form>
      </Card>

      <div className="space-y-4">
        {loaderData.cards.length === 0 ? (
          <p className="text-charcoal/60">No gift cards yet.</p>
        ) : (
          loaderData.cards.map((card) => (
            <Card key={card.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono font-medium text-navy">{card.code}</p>
                <p className="text-sm text-charcoal/60">
                  {formatCurrency(card.balance)} left of {formatCurrency(card.initialAmount)}
                  {card.recipientEmail ? ` · ${card.recipientEmail}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={card.status === "active" ? "success" : "default"}>
                  {card.status}
                </Badge>
                {card.status === "active" && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="disable" />
                    <input type="hidden" name="id" value={card.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Disable
                    </Button>
                  </Form>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
