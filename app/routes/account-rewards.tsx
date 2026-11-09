import { Link } from "react-router";
import type { Route } from "./+types/account-rewards";
import { tryDb } from "~/db.server";
import { resolveGiftCardFromLabel } from "~/lib/gift-card.server";
import { requireCustomer } from "~/lib/session.server";
import { buildMeta } from "~/lib/seo";
import { formatCurrency } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Rewards — shiftshappn",
    description: "Your shiftshappn loyalty points and rewards.",
    path: "/account/rewards",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { customer } = await requireCustomer(request);
  const db = tryDb();
  const email = customer.email.trim().toLowerCase();

  const fresh = db
    ? await db.customer.findUnique({
        where: { id: customer.id },
        select: {
          loyaltyPoints: true,
          loyaltyLedger: { orderBy: { createdAt: "desc" }, take: 12 },
        },
      })
    : null;

  const receivedCards = db
    ? await db.giftCard.findMany({
        where: {
          recipientEmail: { equals: email, mode: "insensitive" },
          status: { not: "disabled" },
        },
        orderBy: { createdAt: "desc" },
        take: 24,
      })
    : [];

  const giftCards = await Promise.all(
    receivedCards.map(async (card) => ({
      id: card.id,
      code: card.code,
      balance: Number(card.balance),
      initialAmount: Number(card.initialAmount),
      note: card.note,
      fromLabel: db
        ? await resolveGiftCardFromLabel(db, card.purchaserEmail)
        : card.purchaserEmail,
      createdAt: card.createdAt.toISOString(),
    }))
  );

  return {
    points: fresh?.loyaltyPoints ?? 0,
    ledger:
      fresh?.loyaltyLedger.map((entry) => ({
        id: entry.id,
        points: entry.points,
        reason: entry.reason,
        createdAt: entry.createdAt.toISOString(),
      })) ?? [],
    giftCards,
  };
}

export default function AccountRewards({ loaderData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <p className="mb-4 text-sm">
        <Link to="/account" className="text-navy hover:text-terracotta">
          ← Account
        </Link>
      </p>
      <h1 className="font-serif text-3xl text-navy">Rewards</h1>
      <p className="mt-3 text-4xl font-medium text-navy">{loaderData.points} pts</p>
      <p className="mt-2 text-sm text-charcoal/60">
        Earn 1 point for every dollar on a paid order. 100 points is a $5 store credit —
        ask us to apply it, or we will add checkout redemption next.
      </p>

      <section className="mt-12">
        <h2 className="font-serif text-xl text-navy">Gift cards for you</h2>
        <p className="mt-1 text-sm text-charcoal/60">
          E-gift cards sent to your email — redeem the code at checkout.
        </p>

        {loaderData.giftCards.length === 0 ? (
          <p className="mt-4 text-charcoal/60">
            No gift cards received yet. When someone sends you an e-gift, it will show up here.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {loaderData.giftCards.map((card) => (
              <div
                key={card.id}
                className="rounded-xl border border-charcoal/10 bg-white px-4 py-4 sm:px-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-semibold tracking-wide text-navy">
                      {card.code}
                    </p>
                    {card.fromLabel ? (
                      <p className="mt-1 text-sm text-charcoal/70">
                        From <strong>{card.fromLabel}</strong>
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-charcoal/60">Gift received</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-navy">
                      {formatCurrency(card.balance)} left
                    </p>
                    <p className="text-xs text-charcoal/50">
                      of {formatCurrency(card.initialAmount)}
                    </p>
                  </div>
                </div>
                {card.note ? (
                  <p className="mt-3 rounded-lg bg-sand/80 px-3 py-2 text-sm italic text-charcoal/80">
                    “{card.note}”
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-charcoal/45">
                  {new Date(card.createdAt).toLocaleDateString("en-CA", {
                    timeZone: "America/Halifax",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 space-y-3">
        <h2 className="font-serif text-xl text-navy">Points activity</h2>
        {loaderData.ledger.length === 0 ? (
          <p className="text-charcoal/60">No points yet. Your next order starts the balance.</p>
        ) : (
          loaderData.ledger.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-lg border border-charcoal/10 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm text-charcoal">{entry.reason}</p>
                <p className="text-xs text-charcoal/50">
                  {new Date(entry.createdAt).toLocaleDateString("en-CA", {
                    timeZone: "America/Halifax",
                  })}
                </p>
              </div>
              <p className="font-medium text-navy">
                {entry.points > 0 ? "+" : ""}
                {entry.points}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
