import { Form, useActionData } from "react-router";
import type { Route } from "./+types/gift-cards";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";
import { formatCurrency } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Gift cards — shiftshappn",
    description: "Give shiftshappn scrubs with a gift card. Check a balance or redeem at checkout.",
    path: "/gift-cards",
  });
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Gift cards are unavailable right now." };
  }
  const db = tryDb();
  if (!db) {
    return { error: "Gift cards are unavailable right now." };
  }

  const formData = await request.formData();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) {
    return { error: "Enter a gift card code." };
  }

  const card = await db.giftCard.findUnique({ where: { code } });
  if (!card || card.status !== "active") {
    return { error: "We could not find an active card with that code." };
  }

  return {
    balance: Number(card.balance),
    initialAmount: Number(card.initialAmount),
    code: card.code,
  };
}

export default function GiftCards({}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <h1 className="font-serif text-3xl text-navy lg:text-4xl">Gift cards</h1>
      <p className="mt-3 max-w-xl text-charcoal/70">
        Send a card for a new grad, a night-shift friend, or your own next pair. Ask us
        to issue one, then redeem the code in your cart.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {["$50", "$100", "$150"].map((amount) => (
          <div
            key={amount}
            className="rounded-xl border border-charcoal/10 bg-white p-6 text-center"
          >
            <p className="font-serif text-2xl text-navy">{amount}</p>
            <p className="mt-1 text-sm text-charcoal/60">Digital code</p>
          </div>
        ))}
      </div>

      <div className="mt-12 max-w-md rounded-xl border border-charcoal/10 bg-white p-6">
        <h2 className="font-serif text-xl text-navy">Check a balance</h2>
        <Form method="post" className="mt-4 space-y-4">
          <Input label="Gift card code" name="code" required placeholder="GC-XXXX-XXXX" />
          {actionData && "error" in actionData && actionData.error && (
            <p className="text-sm text-red-700">{actionData.error}</p>
          )}
          {actionData && "balance" in actionData && (
            <p className="text-sm text-navy">
              {actionData.code} has {formatCurrency(actionData.balance)} left of{" "}
              {formatCurrency(actionData.initialAmount)}.
            </p>
          )}
          <Button type="submit">Check balance</Button>
        </Form>
      </div>
    </div>
  );
}
