import { data, redirect, Link } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/checkout-payment";
import { useCheckout } from "~/lib/checkout-context";
import type { CartItem } from "~/lib/checkout-context";
import { useCart } from "~/lib/cart";
import { formatCurrency, cn } from "~/lib/utils";
import { Button } from "~/components/ui/shadcn-button";
import { tryDb } from "~/db.server";

export async function loader({ request }: Route.LoaderArgs) {
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "place-order");

  if (intent !== "place-order") {
    return data({ error: "Unknown intent" }, { status: 400 });
  }

  const db = tryDb();
  if (!db) return data({ error: "Store unavailable" }, { status: 503 });

  let phase1: any, phase2: any, cartItems: any[];
  try {
    phase1 = JSON.parse(String(formData.get("phase1") ?? "null"));
    phase2 = JSON.parse(String(formData.get("phase2") ?? "null"));
    cartItems = JSON.parse(String(formData.get("cartItems") ?? "[]"));
  } catch {
    return data({ error: "Invalid form data" }, { status: 400 });
  }

  if (!phase1 || !phase2) return data({ error: "Missing prior phase data" }, { status: 400 });

  const { subtotal = 0, discountAmount = 0, giftCardAmount = 0 } = phase1;
  const shippingCost = phase2.shippingCost ?? 0;
  const merchandise = Math.max(0, subtotal - discountAmount - giftCardAmount);
  const tax = Math.round((merchandise + shippingCost) * 0.13 * 100) / 100;
  const total = Math.max(0, merchandise + shippingCost + tax);

  try {
    const orderNumber = `SH-${Date.now().toString(36).slice(2).toUpperCase()}`;
    const isHospitalOrClinic =
      phase2.deliveryLocationType === "hospital" || phase2.deliveryLocationType === "clinic";

    const shippingAddress = isHospitalOrClinic
      ? { name: phase1.email, line1: "", city: "Halifax", province: "NS", postalCode: "", country: "CA" }
      : {
          name: phase2.billingAddress?.name || phase1.email || "",
          line1: phase2.billingAddress?.line1 || "",
          line2: phase2.billingAddress?.line2 || "",
          city: phase2.billingAddress?.city || "",
          province: phase2.billingAddress?.province || "",
          postalCode: phase2.billingAddress?.postalCode || "",
          country: phase2.billingAddress?.country || "CA",
        };

    await db.order.create({
      data: {
        orderNumber,
        customerId: phase1.customerId ?? null,
        email: phase1.email,
        subtotal,
        shipping: shippingCost,
        tax,
        total,
        status: "paid",
        shippingAddress: JSON.stringify(shippingAddress),
        billingAddress: JSON.stringify(phase2.billingAddress || shippingAddress),
        deliveryLocationId: phase2.deliveryLocationId || null,
        deliveryTimeSlotId: phase2.deliveryTimeSlotId || null,
        shippingCost,
        shippingMethod: phase2.shippingMethod || null,
        items: {
          create: cartItems.map((item: any) => ({
            lineType: item.kind === "product" ? "product" : "gift_card",
            productVariantId: item.variantId || undefined,
            quantity: item.quantity,
            priceAtPurchase: item.price,
            productName: item.productName || "Gift Card",
            variantLabel: item.variantLabel || undefined,
          })),
        },
        stripePaymentIntentId: `pi_mock_${Date.now()}`,
      },
    });

    return redirect(`/checkout/success?session_id=${orderNumber}`);
  } catch (error) {
    console.error("Order creation error:", error);
    return data({ error: "Failed to place order. Please try again." }, { status: 500 });
  }
}

// ── Line Item Row ──────────────────────────────────────────────────────────────
function LineItem({ item }: { item: CartItem }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#f0ece6] last:border-0">
      <div
        className="size-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
        style={{ backgroundColor: item.colorHex || "#1b2a4a" }}
      >
        {item.kind === "gift_card" ? "🎁" : item.quantity > 1 ? `×${item.quantity}` : ""}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1b2a4a] truncate">{item.productName}</p>
        <p className="text-xs text-[#888]">{item.variantLabel}</p>
      </div>
      <span className="text-sm font-semibold text-[#1b2a4a] tabular-nums">
        {formatCurrency(item.price * item.quantity)}
      </span>
    </div>
  );
}

// ── Totals Row ─────────────────────────────────────────────────────────────────
function TotalsRow({ label, value, green, bold }: { label: string; value: string; green?: boolean; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between text-sm", bold ? "font-bold text-[#1b2a4a]" : "text-[#666]", green && "text-emerald-600")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function CheckoutPhase3() {
  const { formData, hydrated, clear } = useCheckout();
  const { phase1, phase2 } = formData ?? {};
  const { subtotal = 0, discountAmount = 0, giftCardAmount = 0 } = phase1 ?? {};
  const shippingCost = phase2?.shippingCost ?? 0;
  const lineItems = (formData?.cartItems ?? []) as CartItem[];
  const clearCart = useCart((s) => s.clearCart);
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const merchandise = Math.max(0, subtotal - discountAmount - giftCardAmount);
  const tax = Math.round((merchandise + shippingCost) * 0.13 * 100) / 100;
  const total = Math.max(0, merchandise + shippingCost + tax);

  const handlePlaceOrder = async () => {
    if (!phase1 || !phase2) return;
    setIsPlacing(true);
    setError(null);

    const formData = new FormData();
    formData.append("intent", "place-order");
    formData.append("phase1", JSON.stringify(phase1));
    formData.append("phase2", JSON.stringify(phase2));
    formData.append("cartItems", JSON.stringify(lineItems));

    try {
      const response = await fetch("/checkout/payment", { method: "POST", body: formData });

      if (response.redirected) {
        clearCart();
        clear();
        window.location.href = response.url;
        return;
      }

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Failed to place order.");
        setIsPlacing(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setIsPlacing(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="size-6 animate-spin text-[#1b2a4a]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!phase1 || !phase2) {
    return (
      <div className="text-center py-16">
        <p className="text-[#888] mb-4">Please complete the previous steps first.</p>
        <Button asChild className="bg-[#1b2a4a] text-white rounded-full px-8">
          <Link to="/checkout">Start Checkout</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
      {/* ── Left: Payment / Review ── */}
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#888]">
          <Link to="/checkout" className="hover:text-[#1b2a4a]">Cart</Link>
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <Link to="/checkout/shipping" className="hover:text-[#1b2a4a]">Delivery</Link>
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="font-semibold text-[#1b2a4a]">Payment</span>
        </div>

        {/* Delivery summary card */}
        <section className="rounded-2xl border border-[#e5e0d8] bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e0d8] flex items-center justify-between">
            <h2 className="font-semibold text-sm text-[#1b2a4a]">Delivery Details</h2>
            <Link to="/checkout/shipping" className="text-xs text-[#888] hover:text-[#1b2a4a] underline underline-offset-2">Edit</Link>
          </div>
          <div className="px-6 py-4 space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">
                {phase2.deliveryLocationType === "hospital" ? "🏥" : phase2.deliveryLocationType === "clinic" ? "🏛" : "📦"}
              </span>
              <div>
                <p className="font-medium text-[#1b2a4a]">{phase2.deliveryLocationName || "Custom Address"}</p>
                {phase2.deliveryTimeSlotLabel && (
                  <p className="text-xs text-[#888] mt-0.5">
                    {phase2.deliveryTimeSlotLabel} · {
                      phase2.shippingCost === 0
                        ? <span className="text-emerald-600 font-medium">Free delivery</span>
                        : `${formatCurrency(phase2.shippingCost)} shipping`
                    }
                  </p>
                )}
                {!phase2.deliveryTimeSlotLabel && (
                  <p className="text-xs text-[#888] mt-0.5">
                    {phase2.shippingMethod === "express" ? "Express delivery" : "Standard delivery"} ·{" "}
                    {phase2.shippingCost === 0 ? <span className="text-emerald-600 font-medium">Free</span> : formatCurrency(phase2.shippingCost)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-[#f0ece6]">
              <span className="text-lg">✉️</span>
              <p className="text-sm text-[#555]">{phase1.email}</p>
            </div>
          </div>
        </section>

        {/* Payment placeholder */}
        <section className="rounded-2xl border border-[#e5e0d8] bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e0d8]">
            <h2 className="font-semibold text-sm text-[#1b2a4a]">Payment</h2>
          </div>
          <div className="px-6 py-8 flex flex-col items-center text-center">
            <div className="size-14 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4">
              <svg className="size-7 text-[#1b2a4a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#1b2a4a] mb-1">Payment Ready</p>
            <p className="text-xs text-[#888] max-w-[280px]">
              Your order will be confirmed upon placing. A Stripe payment terminal will be added shortly.
            </p>
            <div className="flex items-center gap-3 mt-5 text-xs text-[#aaa]">
              <div className="flex items-center gap-1">
                <svg className="size-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                SSL Encrypted
              </div>
              <div className="size-1 rounded-full bg-[#ddd]" />
              <span>256-bit security</span>
              <div className="size-1 rounded-full bg-[#ddd]" />
              <span>Stripe powered</span>
            </div>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
            <svg className="size-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-[#d1ccc3] text-[#555] hover:bg-[#f0ece6] px-6"
          >
            <Link to="/checkout/shipping">
              <svg className="size-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </Link>
          </Button>
          <Button
            type="button"
            onClick={handlePlaceOrder}
            disabled={isPlacing}
            className="flex-1 h-14 rounded-2xl bg-[#1b2a4a] hover:bg-[#2a3d6a] text-white text-base font-semibold transition-all disabled:opacity-50"
          >
            {isPlacing ? (
              <span className="flex items-center gap-2">
                <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Placing your order…
              </span>
            ) : (
              <span className="flex items-center justify-between w-full px-2">
                <span>Place Order</span>
                <span className="flex items-center gap-1 opacity-80">
                  {formatCurrency(total)}
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </span>
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-[#aaa]">
          By placing your order you agree to our{" "}
          <Link to="/policies/terms" className="underline hover:text-[#555]">Terms</Link> and{" "}
          <Link to="/policies/privacy" className="underline hover:text-[#555]">Privacy Policy</Link>.
        </p>
      </div>

      {/* ── Right: Final Order Summary ── */}
      <div className="lg:sticky lg:top-24 space-y-4">
        <div className="rounded-2xl border border-[#e5e0d8] bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e5e0d8]">
            <h3 className="font-serif text-sm font-semibold text-[#1b2a4a]">Order Summary</h3>
          </div>
          <div className="px-6 py-2">
            {lineItems.map((item) => <LineItem key={item.variantId} item={item} />)}
          </div>
          <div className="px-6 py-4 bg-[#faf8f5] border-t border-[#e5e0d8] space-y-2">
            <TotalsRow label="Subtotal" value={formatCurrency(subtotal)} />
            {discountAmount > 0 && (
              <TotalsRow label={`Discount (${phase1.promoCode ?? ""})`} value={`−${formatCurrency(discountAmount)}`} green />
            )}
            {giftCardAmount > 0 && (
              <TotalsRow label="Gift Card" value={`−${formatCurrency(giftCardAmount)}`} green />
            )}
            <TotalsRow
              label="Shipping"
              value={shippingCost === 0 ? "Free" : formatCurrency(shippingCost)}
              green={shippingCost === 0}
            />
            <TotalsRow label="Tax (13%)" value={formatCurrency(tax)} />
            <div className="pt-3 border-t border-[#e5e0d8]">
              <TotalsRow label="Total" value={formatCurrency(total)} bold />
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="rounded-2xl border border-[#e5e0d8] bg-white px-5 py-4 space-y-3">
          {[
            { icon: "🔒", text: "256-bit SSL encryption" },
            { icon: "📋", text: "30-day hassle-free returns" },
            { icon: "🚀", text: "Fast, reliable delivery" },
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