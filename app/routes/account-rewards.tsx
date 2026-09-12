import { Link } from "react-router";
import type { Route } from "./+types/account-rewards";
import { tryDb } from "~/db.server";
import { requireCustomer } from "~/lib/session.server";
import { buildMeta } from "~/lib/seo";

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
  const fresh = db
    ? await db.customer.findUnique({
        where: { id: customer.id },
        select: {
          loyaltyPoints: true,
          loyaltyLedger: { orderBy: { createdAt: "desc" }, take: 12 },
        },
      })
    : null;

  return {
    points: fresh?.loyaltyPoints ?? 0,
    ledger:
      fresh?.loyaltyLedger.map((entry) => ({
        id: entry.id,
        points: entry.points,
        reason: entry.reason,
        createdAt: entry.createdAt.toISOString(),
      })) ?? [],
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

      <div className="mt-10 space-y-3">
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
                  {new Date(entry.createdAt).toLocaleDateString()}
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
