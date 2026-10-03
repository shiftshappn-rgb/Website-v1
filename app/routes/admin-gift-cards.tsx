import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-gift-cards";
import { Badge, Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Input, Textarea } from "~/components/ui/Input";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { generateGiftCardCode } from "~/lib/commerce.server";
import { sendGiftCardEmail } from "~/lib/email.server";
import {
  DEFAULT_GIFT_CARD_SHOP,
  formatDenominations,
  parseDenominations,
} from "~/lib/gift-card.shared";
import {
  loadGiftCardShopSettings,
  saveGiftCardShopSettings,
} from "~/lib/gift-card.server";
import { requireAdmin } from "~/lib/session.server";
import { formatCurrency } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }
  await requireAdmin(request);

  const [settings, cards] = await Promise.all([
    loadGiftCardShopSettings(db),
    db.giftCard.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { id: true, orderNumber: true } },
      },
    }),
  ]);

  return {
    dbAvailable: true as const,
    settings,
    cards: cards.map((card) => ({
      id: card.id,
      code: card.code,
      initialAmount: Number(card.initialAmount),
      balance: Number(card.balance),
      purchaserEmail: card.purchaserEmail,
      recipientEmail: card.recipientEmail,
      note: card.note,
      source: card.source,
      status: card.status,
      orderId: card.orderId,
      orderNumber: card.order?.orderNumber ?? null,
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

  if (intent === "settings") {
    const sellEnabled = formData.get("sellEnabled") === "on";
    const denominations = parseDenominations(
      String(formData.get("denominations") ?? "")
    );
    const introCopy = String(formData.get("introCopy") ?? "").trim();

    await saveGiftCardShopSettings(db, {
      sellEnabled,
      denominations,
      introCopy: introCopy || DEFAULT_GIFT_CARD_SHOP.introCopy,
    });
    return redirect("/admin/gift-cards");
  }

  if (intent === "disable") {
    await db.giftCard.update({
      where: { id: String(formData.get("id") ?? "") },
      data: { status: "disabled" },
    });
    return redirect("/admin/gift-cards");
  }

  if (intent === "enable") {
    await db.giftCard.update({
      where: { id: String(formData.get("id") ?? "") },
      data: { status: "active" },
    });
    return redirect("/admin/gift-cards");
  }

  if (intent === "resend") {
    const card = await db.giftCard.findUnique({
      where: { id: String(formData.get("id") ?? "") },
    });
    if (!card) {
      return { error: "Gift card not found." };
    }

    const amount = formatCurrency(Number(card.initialAmount));
    const target = String(formData.get("target") ?? "buyer");

    if (target === "recipient" && card.recipientEmail) {
      await sendGiftCardEmail({
        to: card.recipientEmail,
        code: card.code,
        amount,
        note: card.note,
        isRecipient: true,
        bcc: card.purchaserEmail ?? undefined,
      });
    } else if (card.purchaserEmail) {
      await sendGiftCardEmail({
        to: card.purchaserEmail,
        code: card.code,
        amount,
        note: card.note,
        isRecipient: false,
      });
    } else if (card.recipientEmail) {
      await sendGiftCardEmail({
        to: card.recipientEmail,
        code: card.code,
        amount,
        note: card.note,
        isRecipient: true,
      });
    } else {
      return { error: "No email on file for this card." };
    }

    return redirect("/admin/gift-cards");
  }

  const amount = parseFloat(String(formData.get("amount") ?? "0"));
  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim() || null;
  const purchaserEmail = String(formData.get("purchaserEmail") ?? "").trim() || null;
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
      purchaserEmail,
      recipientEmail,
      note,
      source: "admin",
    },
  });
  return redirect("/admin/gift-cards");
}

export default function AdminGiftCards({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { settings, cards } = loaderData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-navy">Gift cards</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Manage storefront gift card sales, issue staff codes, and resend delivery emails.
        </p>
      </div>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionData.error}
        </div>
      )}

      <Card>
        <h2 className="mb-4 font-medium text-navy">Shop settings</h2>
        <Form method="post" className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="intent" value="settings" />
          <label className="flex items-center gap-3 text-sm text-charcoal sm:col-span-2">
            <input
              type="checkbox"
              name="sellEnabled"
              defaultChecked={settings.sellEnabled}
              className="h-4 w-4 rounded border-charcoal/20"
            />
            Sell gift cards on the storefront
          </label>
          <Input
            label="Denominations (CAD)"
            name="denominations"
            defaultValue={formatDenominations(settings.denominations)}
            className="sm:col-span-2"
            placeholder="50, 75, 100, 150, 200, 250"
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Intro copy on /gift-cards"
              name="introCopy"
              defaultValue={settings.introCopy}
              rows={3}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save settings</Button>
          </div>
        </Form>
      </Card>

      <Card>
        <h2 className="mb-4 font-medium text-navy">Issue gift card</h2>
        <Form method="post" className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="intent" value="create" />
          <Input label="Amount (CAD)" name="amount" type="number" step="1" min="10" required defaultValue="50" />
          <Input label="Code" name="code" placeholder="Leave blank to generate" />
          <Input label="Purchaser email" name="purchaserEmail" type="email" />
          <Input label="Recipient email" name="recipientEmail" type="email" />
          <Input name="note" label="Note" placeholder="Birthday, staff gift…" className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <Button type="submit">Issue card</Button>
          </div>
        </Form>
      </Card>

      <Card>
        <h2 className="mb-4 font-medium text-navy">Gift card ledger</h2>
        {cards.length === 0 ? (
          <p className="text-charcoal/60">No gift cards yet.</p>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => (
              <div
                key={card.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-charcoal/10 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono font-medium text-navy">{card.code}</p>
                    <Badge variant={card.source === "purchase" ? "default" : "success"}>
                      {card.source}
                    </Badge>
                    <Badge variant={card.status === "active" ? "success" : "default"}>
                      {card.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-charcoal/70">
                    {formatCurrency(card.balance)} left of {formatCurrency(card.initialAmount)}
                  </p>
                  {card.purchaserEmail && (
                    <p className="text-sm text-charcoal/60">Buyer: {card.purchaserEmail}</p>
                  )}
                  {card.recipientEmail && (
                    <p className="text-sm text-charcoal/60">Recipient: {card.recipientEmail}</p>
                  )}
                  {card.note && (
                    <p className="text-sm italic text-charcoal/55">“{card.note}”</p>
                  )}
                  {card.orderNumber && card.orderId && (
                    <Link
                      to={`/admin/orders/${card.orderId}`}
                      className="text-sm text-navy hover:text-terracotta"
                    >
                      Order {card.orderNumber}
                    </Link>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {(card.purchaserEmail || card.recipientEmail) && (
                    <Form method="post">
                      <input type="hidden" name="intent" value="resend" />
                      <input type="hidden" name="id" value={card.id} />
                      <input type="hidden" name="target" value="buyer" />
                      <Button type="submit" size="sm" variant="outline">
                        Resend to buyer
                      </Button>
                    </Form>
                  )}
                  {card.recipientEmail && (
                    <Form method="post">
                      <input type="hidden" name="intent" value="resend" />
                      <input type="hidden" name="id" value={card.id} />
                      <input type="hidden" name="target" value="recipient" />
                      <Button type="submit" size="sm" variant="outline">
                        Resend to recipient
                      </Button>
                    </Form>
                  )}
                  {card.status === "active" ? (
                    <Form method="post">
                      <input type="hidden" name="intent" value="disable" />
                      <input type="hidden" name="id" value={card.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Disable
                      </Button>
                    </Form>
                  ) : (
                    <Form method="post">
                      <input type="hidden" name="intent" value="enable" />
                      <input type="hidden" name="id" value={card.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Re-enable
                      </Button>
                    </Form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
