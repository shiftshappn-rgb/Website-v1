import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLoaderData, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/checkout-payment";
import {
  StripePaymentSection,
  type StripePaymentSectionHandle,
} from "~/components/storefront/StripePaymentSection";
import { OrderLineGroups } from "~/components/storefront/OrderLineGroups";
import { Button } from "~/components/ui/shadcn-button";
import { tryDb } from "~/db.server";
import { useCart } from "~/lib/cart";
import { useCheckout } from "~/lib/checkout-context";
import type { CartItem } from "~/lib/checkout-context";
import { getStripePublishableKey } from "~/lib/stripe.server";
import {
  computeTaxAmount,
  DEFAULT_TAX_RATE_PERCENT,
  taxLabel,
} from "~/lib/tax";
import { loadTaxRatePercent } from "~/lib/tax.server";
import { cn, formatCurrency } from "~/lib/utils";

type Phase1 = {
  email?: string;
  subtotal?: number;
  discountAmount?: number;
  giftCardAmount?: number;
  giftCardCode?: string;
  promoCode?: string;
};

type Phase2 = {
  shippingCost?: number;
  deliveryLocationType?: string;
  deliveryLocationName?: string;
  deliveryLocationId?: string;
  deliveryTimeSlotId?: string;
  deliveryTimeSlotLabel?: string;
  shippingMethod?: string;
  billingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
};

function computeTotals(phase1: Phase1, phase2: Phase2, taxRatePercent: number) {
  const subtotal = Number(phase1.subtotal ?? 0);
  const discountAmount = Number(phase1.discountAmount ?? 0);
  const giftCardAmount = Number(phase1.giftCardAmount ?? 0);
  const shippingCost = Number(phase2.shippingCost ?? 0);
  const merchandise = Math.max(0, subtotal - discountAmount - giftCardAmount);
  const tax = computeTaxAmount(merchandise + shippingCost, taxRatePercent);
  const total = Math.max(0, merchandise + shippingCost + tax);
  return {
    subtotal,
    discountAmount,
    giftCardAmount,
    shippingCost,
    merchandise,
    tax,
    total,
    taxRatePercent,
  };
}

export async function loader(_args: Route.LoaderArgs) {
  const publishableKey = getStripePublishableKey().trim();
  const secretKey = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  const taxRatePercent = await loadTaxRatePercent(tryDb());
  return {
    publishableKey,
    stripeConfigured: Boolean(publishableKey && secretKey),
    stripeMissing: !secretKey
      ? ("secret" as const)
      : !publishableKey
        ? ("publishable" as const)
        : null,
    taxRatePercent,
  };
}

function TotalsRow({
  label,
  value,
  green,
  bold,
}: {
  label: string;
  value: string;
  green?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between text-sm",
        bold ? "font-bold text-[#1b2a4a]" : "text-[#666]",
        green && "text-emerald-600"
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise(publishableKey: string) {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

export default function CheckoutPhase3() {
  const {
    publishableKey,
    stripeConfigured,
    stripeMissing,
    taxRatePercent: loaderTaxRate,
  } = useLoaderData<typeof loader>();
  const checkoutLayout = useRouteLoaderData("routes/checkout-layout") as
    | { taxRatePercent?: number }
    | undefined;
  const taxRatePercent =
    loaderTaxRate ?? checkoutLayout?.taxRatePercent ?? DEFAULT_TAX_RATE_PERCENT;
  const { formData, hydrated, clear } = useCheckout();
  const { phase1, phase2 } = formData ?? {};
  const lineItems = (formData?.cartItems ?? []) as CartItem[];
  const cartKey = useMemo(() => JSON.stringify(lineItems), [lineItems]);
  const clearCart = useCart((s) => s.clearCart);

  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [newsOptIn, setNewsOptIn] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [piLoading, setPiLoading] = useState(false);
  const [serverTotals, setServerTotals] = useState<{
    subtotal?: number;
    discountAmount?: number;
    giftCardAmount?: number;
    shippingCost?: number;
    tax?: number;
    total?: number;
  } | null>(null);
  const [idempotencyKey] = useState(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });
  const paymentRef = useRef<StripePaymentSectionHandle>(null);

  const totals = useMemo(() => {
    if (!phase1 || !phase2) {
      return {
        subtotal: 0,
        discountAmount: 0,
        giftCardAmount: 0,
        shippingCost: 0,
        tax: 0,
        total: 0,
        taxRatePercent,
      };
    }
    const local = computeTotals(phase1, phase2, taxRatePercent);
    if (!serverTotals) return local;
    return {
      ...local,
      subtotal: serverTotals.subtotal ?? local.subtotal,
      discountAmount: serverTotals.discountAmount ?? local.discountAmount,
      giftCardAmount: serverTotals.giftCardAmount ?? local.giftCardAmount,
      shippingCost: serverTotals.shippingCost ?? local.shippingCost,
      tax: serverTotals.tax ?? local.tax,
      total: serverTotals.total ?? local.total,
    };
  }, [phase1, phase2, taxRatePercent, serverTotals]);

  const needsCard = totals.total > 0;

  useEffect(() => {
    if (!hydrated || !phase1 || !phase2 || !needsCard) {
      setClientSecret(null);
      setPaymentIntentId(null);
      return;
    }
    if (!stripeConfigured || !publishableKey) {
      setError(
        stripeMissing === "secret"
          ? "Stripe secret key is missing. Add STRIPE_SECRET_KEY to .env (local) or Vercel, then restart/redeploy."
          : stripeMissing === "publishable"
            ? "Stripe publishable key is missing. Add STRIPE_PUBLISHABLE_KEY to .env or Vercel, then restart/redeploy."
            : "Payments are not configured. Please contact support."
      );
      return;
    }

    let cancelled = false;
    setPiLoading(true);
    setError(null);

    const body = new FormData();
    body.append("intent", "create-payment-intent");
    body.append("phase1", JSON.stringify(phase1));
    body.append("phase2", JSON.stringify(phase2));
    body.append("cartItems", cartKey);

    fetch("/api/checkout/payment", { method: "POST", body })
      .then(async (response) => {
        let result: {
          error?: string;
          clientSecret?: string | null;
          paymentIntentId?: string | null;
          subtotal?: number;
          discountAmount?: number;
          giftCardAmount?: number;
          shippingCost?: number;
          tax?: number;
          total?: number;
        } = {};
        try {
          result = await response.json();
        } catch {
          if (!cancelled) {
            setError("Unable to start payment. Please try again.");
            setClientSecret(null);
          }
          return;
        }
        if (cancelled) return;
        if (!response.ok) {
          setError(result.error || "Unable to start payment.");
          setClientSecret(null);
          return;
        }
        setClientSecret(result.clientSecret ?? null);
        setPaymentIntentId(result.paymentIntentId ?? null);
        setServerTotals({
          subtotal: result.subtotal,
          discountAmount: result.discountAmount,
          giftCardAmount: result.giftCardAmount,
          shippingCost: result.shippingCost,
          tax: result.tax,
          total: result.total,
        });
      })
      .catch(() => {
        if (!cancelled) setError("Network error starting payment.");
      })
      .finally(() => {
        if (!cancelled) setPiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    needsCard,
    phase1,
    phase2,
    cartKey,
    stripeConfigured,
    publishableKey,
  ]);

  async function handlePlaceOrder() {
    if (!phase1 || !phase2) return;
    if (!agreed) {
      setError("Please agree to the Delivery, Returns, and Privacy policies.");
      return;
    }

    setIsPlacing(true);
    setError(null);

    try {
      let confirmedPaymentIntentId = paymentIntentId;

      if (needsCard) {
        if (!paymentRef.current) {
          setError("Payment form is still loading.");
          setIsPlacing(false);
          return;
        }
        const confirmed = await paymentRef.current.confirm();
        if ("error" in confirmed) {
          setError(confirmed.error);
          setIsPlacing(false);
          return;
        }
        confirmedPaymentIntentId = confirmed.paymentIntentId;
      }

      const body = new FormData();
      body.append("intent", "place-order");
      body.append("phase1", JSON.stringify(phase1));
      body.append("phase2", JSON.stringify(phase2));
      body.append("cartItems", JSON.stringify(lineItems));
      body.append("agreePolicies", "on");
      body.append("idempotencyKey", idempotencyKey);
      if (newsOptIn) body.append("marketingOptIn", "on");
      if (confirmedPaymentIntentId) {
        body.append("paymentIntentId", confirmedPaymentIntentId);
      }

      const response = await fetch("/api/checkout/payment", { method: "POST", body });

      if (response.redirected) {
        clearCart();
        clear();
        window.location.href = response.url;
        return;
      }

      const result = await response.json();
      setError(result.error || "Failed to place order.");
      setIsPlacing(false);
    } catch {
      setError("Network error. Please try again.");
      setIsPlacing(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="size-6 animate-spin text-[#1b2a4a]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  if (!phase1 || !phase2) {
    return (
      <div className="text-center py-16">
        <p className="mb-4 text-[#888]">Please complete the previous steps first.</p>
        <Button asChild className="rounded-full bg-[#1b2a4a] px-8 text-white">
          <Link to="/checkout">Start Checkout</Link>
        </Button>
      </div>
    );
  }

  const paymentReady = !needsCard || Boolean(clientSecret);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs text-[#888]">
          <Link to="/checkout" className="hover:text-[#1b2a4a]">
            Cart
          </Link>
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link to="/checkout/shipping" className="hover:text-[#1b2a4a]">
            Delivery
          </Link>
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold text-[#1b2a4a]">Payment</span>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#e5e0d8] bg-white">
          <div className="flex items-center justify-between border-b border-[#e5e0d8] px-6 py-4">
            <h2 className="text-sm font-semibold text-[#1b2a4a]">Delivery Details</h2>
            <Link
              to="/checkout/shipping"
              className="text-xs text-[#888] underline underline-offset-2 hover:text-[#1b2a4a]"
            >
              Edit
            </Link>
          </div>
          <div className="space-y-2 px-6 py-4 text-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg">
                {phase2.deliveryLocationType === "hospital"
                  ? "🏥"
                  : phase2.deliveryLocationType === "clinic"
                    ? "🏛"
                    : "📦"}
              </span>
              <div>
                <p className="font-medium text-[#1b2a4a]">
                  {phase2.deliveryLocationName || "Custom Address"}
                </p>
                {phase2.deliveryTimeSlotLabel ? (
                  <p className="mt-0.5 text-xs text-[#888]">
                    {phase2.deliveryTimeSlotLabel} ·{" "}
                    {phase2.shippingCost === 0 ? (
                      <span className="font-medium text-emerald-600">Free delivery</span>
                    ) : (
                      `${formatCurrency(phase2.shippingCost ?? 0)} shipping`
                    )}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-[#888]">
                    {phase2.shippingMethod === "express"
                      ? "Express delivery"
                      : "Standard delivery"}{" "}
                    ·{" "}
                    {phase2.shippingCost === 0 ? (
                      <span className="font-medium text-emerald-600">Free</span>
                    ) : (
                      formatCurrency(phase2.shippingCost ?? 0)
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-[#f0ece6] pt-2">
              <span className="text-lg">✉️</span>
              <p className="text-sm text-[#555]">{phase1.email}</p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#e5e0d8] bg-white">
          <div className="border-b border-[#e5e0d8] px-6 py-4">
            <h2 className="text-sm font-semibold text-[#1b2a4a]">Payment</h2>
          </div>
          <div className="px-6 py-6">
            {!needsCard ? (
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Your gift card covers this order — no card charge needed.
              </div>
            ) : piLoading || !clientSecret ? (
              <div className="flex items-center gap-3 text-sm text-[#888]">
                <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Loading secure payment…
              </div>
            ) : (
              <Elements
                stripe={getStripePromise(publishableKey)}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "#1b2a4a",
                      borderRadius: "12px",
                    },
                  },
                }}
              >
                <StripePaymentSection ref={paymentRef} />
              </Elements>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-[#aaa]">
              <div className="flex items-center gap-1">
                <svg
                  className="size-3.5 text-emerald-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
                SSL Encrypted
              </div>
              <div className="size-1 rounded-full bg-[#ddd]" />
              <span>Powered by Stripe</span>
            </div>
          </div>
        </section>

        {error && (
          <div
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            <svg
              className="mt-0.5 size-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </div>
        )}

        <label className="flex items-start gap-3 text-sm text-[#444]">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-1 rounded border-[#d1ccc3]"
          />
          <span>
            I agree to the{" "}
            <Link to="/policies/shipping" className="underline hover:text-[#1b2a4a]">
              Delivery
            </Link>
            ,{" "}
            <Link to="/policies/returns" className="underline hover:text-[#1b2a4a]">
              Returns
            </Link>
            , and{" "}
            <Link to="/policies/privacy" className="underline hover:text-[#1b2a4a]">
              Privacy
            </Link>{" "}
            policies.
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-[#444]">
          <input
            type="checkbox"
            checked={newsOptIn}
            onChange={(event) => setNewsOptIn(event.target.checked)}
            className="mt-1 rounded border-[#d1ccc3]"
          />
          <span>Email me news and launches. You can unsubscribe any time.</span>
        </label>

        <div className="flex gap-3">
          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-[#d1ccc3] px-6 text-[#555] hover:bg-[#f0ece6]"
          >
            <Link to="/checkout/shipping">
              <svg
                className="mr-1.5 size-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </Link>
          </Button>
          <Button
            type="button"
            onClick={handlePlaceOrder}
            disabled={isPlacing || !agreed || !paymentReady}
            className="h-14 flex-1 rounded-2xl bg-[#1b2a4a] text-base font-semibold text-white transition-all hover:bg-[#2a3d6a] disabled:opacity-50"
          >
            {isPlacing ? (
              <span className="flex items-center gap-2">
                <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {needsCard ? "Processing payment…" : "Placing your order…"}
              </span>
            ) : (
              <span className="flex w-full items-center justify-between px-2">
                <span>Place Order</span>
                <span className="flex items-center gap-1 opacity-80">
                  {formatCurrency(totals.total)}
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </span>
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-2xl border border-[#e5e0d8] bg-white">
          <div className="border-b border-[#e5e0d8] px-6 py-4">
            <h3 className="font-serif text-sm font-semibold text-[#1b2a4a]">Order Summary</h3>
          </div>
          <div className="px-6 py-4">
            <OrderLineGroups
              items={lineItems.map((item) => ({
                productName: item.productName,
                variantLabel: item.variantLabel,
                quantity: item.quantity,
                priceAtPurchase: item.price,
              }))}
              className="space-y-4"
            />
          </div>
          <div className="space-y-2 border-t border-[#e5e0d8] bg-[#faf8f5] px-6 py-4">
            <TotalsRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
            {totals.discountAmount > 0 && (
              <TotalsRow
                label={`Discount (${phase1.promoCode ?? ""})`}
                value={`−${formatCurrency(totals.discountAmount)}`}
                green
              />
            )}
            {totals.giftCardAmount > 0 && (
              <TotalsRow
                label="Gift Card"
                value={`−${formatCurrency(totals.giftCardAmount)}`}
                green
              />
            )}
            <TotalsRow
              label="Shipping"
              value={totals.shippingCost === 0 ? "Free" : formatCurrency(totals.shippingCost)}
              green={totals.shippingCost === 0}
            />
            {totals.taxRatePercent > 0 ? (
              <TotalsRow
                label={taxLabel(totals.taxRatePercent)}
                value={formatCurrency(totals.tax)}
              />
            ) : (
              <TotalsRow label="Inclusive of tax" value="—" />
            )}
            <div className="border-t border-[#e5e0d8] pt-3">
              <TotalsRow label="Total" value={formatCurrency(totals.total)} bold />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-[#e5e0d8] bg-white px-5 py-4">
          {[
            { icon: "🔒", text: "256-bit SSL encryption" },
            { icon: "📋", text: "Free size exchange within 30 days" },
            { icon: "🚀", text: "Free Shift Drop at your hospital" },
            { icon: "💬", text: "24/7 customer support" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2.5 text-xs text-[#666]">
              <span className="text-base">{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
