import { useEffect, useState } from "react";
import { Form, useActionData, useLoaderData, useSearchParams } from "react-router";
import { Minus, Plus } from "lucide-react";
import type { Route } from "./+types/gift-cards";
import { GiftCardPreview } from "~/components/storefront/GiftCardPreview";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { useCart } from "~/lib/cart";
import { tryDb, isDatabaseAvailable } from "~/db.server";
import { DEFAULT_GIFT_CARD_SHOP } from "~/lib/gift-card.shared";
import { loadGiftCardShopSettings } from "~/lib/gift-card.server";
import { buildMeta } from "~/lib/seo";
import { formatCurrency } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Gift cards — shiftshappn",
    description:
      "Give shiftshappn scrubs with a digital gift card. Choose an amount, add to cart, and codes are emailed after checkout.",
    path: "/gift-cards",
  });
}

export async function loader() {
  const db = tryDb();
  const settings = await loadGiftCardShopSettings(db);
  return { settings };
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

export default function GiftCards({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const settings = loaderData?.settings ?? DEFAULT_GIFT_CARD_SHOP;
  const denominations = settings.denominations;
  const [searchParams] = useSearchParams();
  const amountFromUrl = Number.parseInt(searchParams.get("amount") ?? "", 10);
  const initialAmount =
    Number.isFinite(amountFromUrl) && denominations.includes(amountFromUrl)
      ? amountFromUrl
      : denominations[0] ?? 50;
  const [amount, setAmount] = useState(initialAmount);

  useEffect(() => {
    if (
      Number.isFinite(amountFromUrl) &&
      denominations.includes(amountFromUrl)
    ) {
      setAmount(amountFromUrl);
    }
  }, [amountFromUrl, denominations]);
  const [quantity, setQuantity] = useState(1);
  const [sendAsGift, setSendAsGift] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [giftNote, setGiftNote] = useState("");
  const addGiftCard = useCart((s) => s.addGiftCard);
  const openCart = useCart((s) => s.openCart);

  function handleAddToCart() {
    if (!settings.sellEnabled) return;
    if (sendAsGift && !recipientEmail.trim()) return;

    addGiftCard({
      amount,
      recipientEmail: sendAsGift ? recipientEmail.trim() : undefined,
      giftNote: sendAsGift ? giftNote.trim() : undefined,
      quantity,
    });
    openCart();
  }

  return (
    <div className="bg-sand">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <GiftCardPreview amount={amount} />

          <div className="lg:pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-charcoal/50">
              shiftshappn
            </p>
            <h1 className="mt-2 font-serif text-3xl text-navy lg:text-4xl">
              ShiftsHappn e-gift card
            </h1>
            <p className="mt-3 text-2xl font-medium text-charcoal">
              {formatCurrency(amount)} CAD
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-charcoal/70">
              {settings.introCopy}
            </p>

            <div className="mt-8">
              <p className="mb-3 text-sm font-medium text-charcoal">Denominations</p>
              <div className="flex flex-wrap gap-2">
                {denominations.map((value) => {
                  const selected = value === amount;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAmount(value)}
                      className={`min-h-11 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                        selected
                          ? "border-navy bg-navy text-white"
                          : "border-charcoal/15 bg-white text-charcoal hover:border-navy/30"
                      }`}
                    >
                      {formatCurrency(value)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <span className="text-sm font-medium text-charcoal">Quantity</span>
              <div className="inline-flex items-center rounded-lg border border-charcoal/15 bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-11 w-11 items-center justify-center text-charcoal/70 hover:text-charcoal"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-sm font-medium">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-11 w-11 items-center justify-center text-charcoal/70 hover:text-charcoal"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <label className="mt-6 flex items-start gap-3 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={sendAsGift}
                onChange={(e) => setSendAsGift(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-charcoal/20"
              />
              <span>I want to send this as a gift</span>
            </label>

            {sendAsGift && (
              <div className="mt-4 space-y-4 rounded-xl border border-charcoal/10 bg-white p-4">
                <Input
                  label="Recipient email"
                  name="recipientEmail"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  required={sendAsGift}
                />
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-charcoal">Gift message</span>
                  <textarea
                    value={giftNote}
                    onChange={(e) => setGiftNote(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-charcoal/20 px-3 py-2.5 text-sm"
                    placeholder="Happy graduation — pick your favourite scrubs."
                  />
                </label>
              </div>
            )}

            {settings.sellEnabled ? (
              <Button
                type="button"
                variant="terracotta"
                className="mt-8 w-full sm:w-auto sm:min-w-[220px]"
                onClick={handleAddToCart}
              >
                Add to cart
              </Button>
            ) : (
              <p className="mt-8 rounded-xl bg-white px-4 py-3 text-sm text-charcoal/70">
                Gift card sales are paused right now. You can still check a balance below.
              </p>
            )}

            <div className="mt-8 space-y-2 text-sm text-charcoal/65">
              <p>Give the gift of choice.</p>
              <p>
                Codes are emailed after checkout. Recipients can redeem them on any order at
                shiftshappn.com.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 max-w-md rounded-xl border border-charcoal/10 bg-white p-6">
          <h2 className="font-serif text-xl text-navy">Check a balance</h2>
          <Form method="post" className="mt-4 space-y-4">
            <Input label="Gift card code" name="code" required placeholder="GC-XXXX-XXXX" />
            {actionData && "error" in actionData && actionData.error && (
              <p className="text-sm text-red-700">{actionData.error}</p>
            )}
            {actionData &&
              "balance" in actionData &&
              actionData.balance != null &&
              actionData.initialAmount != null && (
              <p className="text-sm text-navy">
                {actionData.code} has {formatCurrency(actionData.balance)} left of{" "}
                {formatCurrency(actionData.initialAmount)}.
              </p>
            )}
            <Button type="submit">Check balance</Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
