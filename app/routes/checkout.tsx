import { Form, data } from "react-router";
import type { Route } from "./+types/checkout";
import { tryDb } from "~/db.server";
import {
  verifyPassword,
  hashPassword,
  getCustomer,
  commitCustomerSessionCookie,
} from "~/lib/session.server";
import { isGoogleOAuthConfigured } from "~/lib/google-auth.server";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";
import { resolveDiscountCode, resolveGiftCard } from "~/lib/commerce.server";
import { buildMeta } from "~/lib/seo";
import { useCheckout } from "~/lib/checkout-context";
import { useCart } from "~/lib/cart";
import { formatCurrency, cn } from "~/lib/utils";
import { useEffect, useState } from "react";
import { Link, useNavigate, useLoaderData } from "react-router";
import { Button } from "~/components/ui/shadcn-button";
import { Input as ShadInput } from "~/components/ui/shadcn-input";
import { Badge } from "~/components/ui/shadcn-badge";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Checkout — shiftshappn",
    description: "Review your cart and choose how to check out.",
    path: "/checkout",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const db = tryDb();
  const customer = db ? await getCustomer(request) : null;

  return {
    dbAvailable: !!db,
    googleAuthEnabled: isGoogleOAuthConfigured(),
    customer: customer
      ? {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          avatarUrl: customer.avatarUrl,
          addresses: customer.addresses.map((a) => ({
            id: a.id,
            label: a.label,
            line1: a.line1,
            line2: a.line2,
            city: a.city,
            province: a.province,
            postalCode: a.postalCode,
            country: a.country,
            isDefault: a.isDefault,
          })),
        }
      : null,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const db = tryDb();
  if (!db) return data({ error: "Store unavailable" }, { status: 503 });

  const formData = await request.formData();

  const cartJson = String(formData.get("cart") ?? "[]");
  let cartItems: Array<{
    variantId: string;
    productId: string;
    productName: string;
    variantLabel: string;
    colorHex: string;
    price: number;
    quantity: number;
    imagePublicId?: string;
    imageAlt?: string;
    kind?: "product" | "gift_card";
    giftAmount?: number;
    recipientEmail?: string;
    giftNote?: string;
  }> = [];

  try {
    cartItems = JSON.parse(cartJson);
  } catch {
    return data({ error: "Invalid cart data" }, { status: 400 });
  }

  if (!cartItems.length) return data({ error: "Cart is empty" }, { status: 400 });

  const lineItems: Array<{
    kind: "product" | "gift_card";
    variantId?: string;
    quantity: number;
    price: number;
    productName?: string;
    variantLabel?: string;
    amount?: number;
  }> = [];

  let hasGiftCards = false;
  let hasProducts = false;

  for (const item of cartItems) {
    if (item.kind === "gift_card") {
      hasGiftCards = true;
      const amount = item.giftAmount ?? item.price;
      if (!Number.isFinite(amount) || amount < 10) {
        return data({ error: "Invalid gift card amount." }, { status: 400 });
      }
      lineItems.push({ kind: "gift_card", quantity: item.quantity, amount, price: amount });
      continue;
    }

    hasProducts = true;
    const variant = await db.productVariant.findUnique({
      where: { id: item.variantId },
      include: { product: true },
    });

    if (!variant || variant.product.status !== "active") {
      return data({ error: `Product unavailable: ${item.productName}` }, { status: 400 });
    }
    if (variant.inventoryQty < item.quantity) {
      return data(
        { error: `Insufficient stock for ${item.productName} (${item.variantLabel})` },
        { status: 400 }
      );
    }

    const price = Number(variant.product.basePrice);
    const finalPrice = variant.priceOverride ? Number(variant.priceOverride) : price;
    lineItems.push({
      kind: "product",
      variantId: variant.id,
      quantity: item.quantity,
      price: finalPrice,
      productName: variant.product.name,
      variantLabel: `${variant.colorName} / ${variant.size}`,
    });
  }

  const subtotal = lineItems.reduce((sum, item) => {
    const price = item.kind === "gift_card" ? item.amount! : item.price;
    return sum + price * item.quantity;
  }, 0);

  const discountCodeRaw = String(formData.get("discountCode") ?? "").trim().toUpperCase();
  const giftCardCodeRaw = String(formData.get("giftCardCode") ?? "").trim().toUpperCase();

  let discountAmount = 0;
  let shipping = hasProducts ? (subtotal >= 100 ? 0 : 9.95) : 0;
  const originalShipping = shipping;

  if (discountCodeRaw) {
    const resolved = await resolveDiscountCode(db, discountCodeRaw, subtotal);
    if ("error" in resolved) return data({ error: resolved.error }, { status: 400 });
    if (resolved.discount.type === "free_shipping") {
      shipping = 0;
      discountAmount = originalShipping;
    } else {
      discountAmount = Math.min(
        resolved.discount.type === "percent"
          ? Math.round(subtotal * (Number(resolved.discount.value) / 100) * 100) / 100
          : Number(resolved.discount.value),
        subtotal
      );
    }
  }

  let giftCardAmount = 0;
  if (giftCardCodeRaw && hasProducts) {
    const resolved = await resolveGiftCard(db, giftCardCodeRaw);
    if ("error" in resolved) return data({ error: resolved.error }, { status: 400 });
    const merchandise = subtotal - Math.min(discountAmount, subtotal);
    giftCardAmount = Math.min(Number(resolved.card.balance), merchandise + shipping);
  }

  const sessionCustomer = await getCustomer(request);
  const accountChoice = String(formData.get("accountChoice") ?? "guest") as
    | "guest"
    | "login"
    | "register";
  const emailFromForm = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  let customerId: string | undefined;
  let email = emailFromForm;
  let resolvedAccountChoice = accountChoice;
  let shouldSetSession = false;

  if (sessionCustomer) {
    customerId = sessionCustomer.id;
    email = sessionCustomer.email;
    resolvedAccountChoice = "login";
  } else if (accountChoice === "login") {
    if (!email) return data({ error: "Email is required." }, { status: 400 });
    if (!password) return data({ error: "Password is required for login." }, { status: 400 });
    const customer = await db.customer.findUnique({ where: { email } });
    if (!customer?.passwordHash) return data({ error: "Invalid email or password." }, { status: 401 });
    const valid = await verifyPassword(password, customer.passwordHash);
    if (!valid) return data({ error: "Invalid email or password." }, { status: 401 });
    customerId = customer.id;
    shouldSetSession = true;
  } else if (accountChoice === "register") {
    if (!email) return data({ error: "Email is required." }, { status: 400 });
    if (!password || password.length < 8) {
      return data({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    const existing = await db.customer.findUnique({ where: { email } });
    if (existing) return data({ error: "An account with this email already exists." }, { status: 409 });
    const passwordHash = await hashPassword(password);
    const customer = await db.customer.create({
      data: { email, name: name || null, passwordHash, marketingOptIn: false },
    });
    customerId = customer.id;
    shouldSetSession = true;
  } else {
    if (!email) return data({ error: "Email is required." }, { status: 400 });
  }

  const headers: HeadersInit = {};
  if (shouldSetSession && customerId) {
    headers["Set-Cookie"] = await commitCustomerSessionCookie(customerId);
  }

  return data(
    {
      success: true,
      redirectTo: "/checkout/shipping",
      phase1Data: {
        accountChoice: resolvedAccountChoice,
        email,
        customerId,
        promoCode: discountCodeRaw || undefined,
        giftCardCode: giftCardCodeRaw || undefined,
        discountAmount,
        giftCardAmount,
        subtotal,
        hasGiftCards,
        hasProducts,
      },
      lineItems,
    },
    { headers }
  );
}

// ── Order Summary Sidebar ──────────────────────────────────────────────────────
function OrderSummary({
  items,
  subtotal,
  discountAmount,
  giftCardAmount,
  shipping,
  tax,
  total,
  discountCode,
  giftCardCode,
}: {
  items: Array<{ variantId: string; productName: string; variantLabel: string; colorHex: string; price: number; quantity: number; kind?: string }>;
  subtotal: number;
  discountAmount: number;
  giftCardAmount: number;
  shipping: number;
  tax: number;
  total: number;
  discountCode: string;
  giftCardCode: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e5e0d8] bg-white overflow-hidden">
      <div className="px-6 py-5 border-b border-[#e5e0d8]">
        <h2 className="font-serif text-base font-semibold text-[#1b2a4a]">Order Summary</h2>
      </div>

      {/* Items */}
      <ul className="divide-y divide-[#f0ece6] px-6">
        {items.map((item) => (
          <li key={item.variantId} className="flex items-center gap-3 py-4">
            {/* Color swatch / gift icon */}
            <div
              className="size-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-inner"
              style={{ backgroundColor: item.colorHex || "#1b2a4a" }}
            >
              {item.kind === "gift_card" ? "🎁" : item.quantity > 1 ? `×${item.quantity}` : ""}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1b2a4a] truncate">{item.productName}</p>
              <p className="text-xs text-[#888] truncate">{item.variantLabel}</p>
            </div>
            <span className="text-sm font-semibold text-[#1b2a4a] tabular-nums">
              {formatCurrency(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      {/* Totals */}
      <div className="px-6 py-5 bg-[#faf8f5] space-y-2 text-sm border-t border-[#e5e0d8]">
        <div className="flex justify-between text-[#666]">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discountCode && discountAmount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span className="flex items-center gap-1.5">
              Discount
              <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono">{discountCode}</span>
            </span>
            <span>−{formatCurrency(discountAmount)}</span>
          </div>
        )}
        {giftCardCode && giftCardAmount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Gift Card</span>
            <span>−{formatCurrency(giftCardAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[#666]">
          <span>Shipping</span>
          <span>{shipping === 0 ? <span className="text-emerald-600 font-medium">Free</span> : formatCurrency(shipping)}</span>
        </div>
        <div className="flex justify-between text-[#666]">
          <span>Est. Tax (13%)</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        <div className="flex justify-between font-bold text-[#1b2a4a] text-base border-t border-[#e5e0d8] pt-3 mt-1">
          <span>Estimated Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Checkout Form ─────────────────────────────────────────────────────────
function CheckoutForm() {
  const { customer: loggedInCustomer, googleAuthEnabled } = useLoaderData<typeof loader>();
  const { items: cartItems } = useCart();
  const { updatePhase1, setCartItems, nextPhase } = useCheckout();
  const navigate = useNavigate();
  const [isHydrated, setIsHydrated] = useState(false);
  const isLoggedIn = !!loggedInCustomer;

  useEffect(() => setIsHydrated(true), []);

  const typedCartItems = (isHydrated ? cartItems : []).map((item) => ({
    variantId: item.variantId,
    productId: item.productId,
    productName: item.productName,
    variantLabel: item.variantLabel,
    colorHex: item.colorHex,
    price: item.price,
    quantity: item.quantity,
    imagePublicId: item.imagePublicId,
    imageAlt: item.imageAlt,
    kind: item.kind,
    giftAmount: item.giftAmount,
    recipientEmail: item.recipientEmail,
    giftNote: item.giftNote,
  }));

  const [discountCode, setDiscountCode] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [accountChoice, setAccountChoice] = useState<"guest" | "login" | "register">(
    isLoggedIn ? "login" : "guest"
  );
  const [email, setEmail] = useState(loggedInCustomer?.email ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(loggedInCustomer?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const discountAmount = 0;
  const giftCardAmount = 0;
  const subtotal = typedCartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const hasProducts = typedCartItems.some((item) => (item.kind ?? "product") === "product");
  const shipping = hasProducts && subtotal >= 100 ? 0 : hasProducts ? 9.95 : 0;
  const merchandise = Math.max(0, subtotal - discountAmount);
  const tax = Math.round((merchandise + shipping - giftCardAmount) * 0.13 * 100) / 100;
  const total = Math.max(0, merchandise + shipping - giftCardAmount + tax);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Try server-side validation (promo codes, auth, inventory).
    // If the server has no DB configured (503) or returns non-JSON, fall back
    // to client-side processing so the flow works without a configured backend.
    try {
      const formData = new FormData();
      formData.append("intent", "submit");
      formData.append("cart", JSON.stringify(typedCartItems));
      formData.append("discountCode", discountCode);
      formData.append("giftCardCode", giftCardCode);
      formData.append("accountChoice", isLoggedIn ? "login" : accountChoice);
      formData.append("email", isLoggedIn ? loggedInCustomer!.email : email);
      formData.append("password", password);
      formData.append("name", name);

      const response = await fetch("/checkout", { method: "POST", body: formData });

      // Try to parse JSON; if it fails (HTML error page), fall through to client-side
      let result: any;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (result && response.ok && result.success && result.phase1Data) {
        // Server processed successfully
        updatePhase1(result.phase1Data);
        setCartItems(typedCartItems);
        nextPhase();
        navigate(result.redirectTo);
        return;
      }

      if (result && !response.ok && response.status !== 503) {
        // Real server-side validation error (not a missing-DB 503)
        setError(result.error || "Something went wrong. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // 503 or parse failure → fall through to client-side below
    } catch {
      // Network error → fall through to client-side below
    }

    // ── Client-side fallback (no DB / Stripe configured) ──────────────────────
    // Skip server validation; promo codes & auth will be re-validated later.
    updatePhase1({
      accountChoice: isLoggedIn ? "login" : accountChoice,
      email,
      customerId: loggedInCustomer?.id,
      promoCode: discountCode || undefined,
      giftCardCode: giftCardCode || undefined,
      discountAmount: 0,
      giftCardAmount: 0,
      subtotal,
      hasGiftCards: typedCartItems.some((i) => i.kind === "gift_card"),
      hasProducts: typedCartItems.some((i) => (i.kind ?? "product") === "product"),
    });
    setCartItems(typedCartItems);
    nextPhase();
    navigate("/checkout/shipping");
  };

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="size-6 animate-spin text-[#1b2a4a]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!typedCartItems.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="size-16 rounded-full bg-[#f0ece6] flex items-center justify-center mb-5">
          <svg className="size-8 text-[#aaa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <h2 className="font-serif text-xl text-[#1b2a4a] mb-2">Your cart is empty</h2>
        <p className="text-sm text-[#888] mb-6">Add some items before checking out.</p>
        <Button asChild className="bg-[#1b2a4a] hover:bg-[#2a3d6a] text-white rounded-full px-8">
          <Link to="/shop">Browse Shop</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        {/* ── Left Column ── */}
        <div className="space-y-6">

          {/* Contact / Account */}
          <section className="rounded-2xl border border-[#e5e0d8] bg-white overflow-hidden">
            <div className="px-6 py-5 border-b border-[#e5e0d8] flex items-center justify-between gap-4">
              <h2 className="font-serif text-base font-semibold text-[#1b2a4a]">Contact</h2>
              {isLoggedIn ? (
                <Link
                  to="/account/profile"
                  className="text-xs font-medium text-[#1b2a4a] hover:underline underline-offset-2"
                >
                  View profile
                </Link>
              ) : (
                <div className="flex gap-1 bg-[#f0ece6] p-1 rounded-full text-xs font-medium">
                  {(["guest", "login", "register"] as const).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setAccountChoice(choice)}
                      className={cn(
                        "px-3 py-1 rounded-full transition-all capitalize",
                        accountChoice === choice
                          ? "bg-white text-[#1b2a4a] shadow-sm font-semibold"
                          : "text-[#888] hover:text-[#1b2a4a]"
                      )}
                    >
                      {choice === "guest" ? "Guest" : choice === "login" ? "Sign In" : "Register"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-5 space-y-4">
              {isLoggedIn ? (
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                  {loggedInCustomer.avatarUrl ? (
                    <img
                      src={loggedInCustomer.avatarUrl}
                      alt=""
                      className="size-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="size-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                      {(loggedInCustomer.name || loggedInCustomer.email)[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1b2a4a]">
                      Signed in as {loggedInCustomer.name || loggedInCustomer.email}
                    </p>
                    <p className="text-xs text-[#666] mt-0.5">{loggedInCustomer.email}</p>
                    <p className="text-xs text-[#888] mt-2">
                      Your order will be linked to your account.{" "}
                      <Link to="/auth/logout" className="text-[#1b2a4a] underline underline-offset-2">
                        Sign out
                      </Link>
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {accountChoice === "guest" && (
                    <div className="space-y-3">
                      <p className="text-xs text-[#888] bg-[#faf8f5] rounded-lg px-4 py-2.5">
                        No account needed — you&apos;ll get a confirmation email.{" "}
                        <Link
                          to="/auth/login?redirectTo=/checkout"
                          className="text-[#1b2a4a] font-medium underline underline-offset-2"
                        >
                          Already have an account?
                        </Link>
                      </p>
                      {googleAuthEnabled && (
                        <GoogleSignInButton
                          redirectTo="/checkout"
                          className="rounded-xl border-[#d1ccc3] text-[#1b2a4a] hover:bg-[#f0ece6]"
                        />
                      )}
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5"
                    >
                      Email address *
                    </label>
                    <ShadInput
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                      className="border-[#d1ccc3] focus-visible:ring-[#1b2a4a] rounded-xl"
                    />
                  </div>
                  {(accountChoice === "login" || accountChoice === "register") && (
                    <div>
                      <label
                        htmlFor="password"
                        className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5"
                      >
                        Password *
                      </label>
                      <ShadInput
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={accountChoice === "register" ? "Min 8 characters" : "Your password"}
                        required
                        autoComplete={accountChoice === "login" ? "current-password" : "new-password"}
                        minLength={8}
                        className="border-[#d1ccc3] focus-visible:ring-[#1b2a4a] rounded-xl"
                      />
                    </div>
                  )}
                  {accountChoice === "register" && (
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5"
                      >
                        Full Name (optional)
                      </label>
                      <ShadInput
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        autoComplete="name"
                        className="border-[#d1ccc3] focus-visible:ring-[#1b2a4a] rounded-xl"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Promo & Gift Card */}
          <section className="rounded-2xl border border-[#e5e0d8] bg-white overflow-hidden">
            <div className="px-6 py-5 border-b border-[#e5e0d8]">
              <h2 className="font-serif text-base font-semibold text-[#1b2a4a]">Promo &amp; Gift Cards</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex gap-2">
                <ShadInput
                  placeholder="Promo code (e.g. SAVE10)"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                  className="border-[#d1ccc3] focus-visible:ring-[#1b2a4a] rounded-xl font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="flex-shrink-0 rounded-xl border-[#d1ccc3] text-[#1b2a4a] hover:bg-[#f0ece6]"
                >
                  Apply
                </Button>
              </div>
              <div className="flex gap-2">
                <ShadInput
                  placeholder="Gift card code"
                  value={giftCardCode}
                  onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                  className="border-[#d1ccc3] focus-visible:ring-[#1b2a4a] rounded-xl font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="flex-shrink-0 rounded-xl border-[#d1ccc3] text-[#1b2a4a] hover:bg-[#f0ece6]"
                >
                  Apply
                </Button>
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

          {/* CTA */}
          <Button
            type="submit"
            disabled={isSubmitting || (!isLoggedIn && !email)}
            className="w-full h-14 rounded-2xl bg-[#1b2a4a] hover:bg-[#2a3d6a] text-white text-base font-semibold transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing…
              </span>
            ) : (
              <span className="flex items-center justify-between w-full px-2">
                <span>Continue to Delivery</span>
                <span className="flex items-center gap-1 opacity-80">
                  {formatCurrency(total)}
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </span>
            )}
          </Button>

          <p className="text-center text-xs text-[#aaa] flex items-center justify-center gap-1.5">
            <svg className="size-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Secure SSL encryption · Your info is protected
          </p>
        </div>

        {/* ── Right Column: Order Summary ── */}
        <div className="lg:sticky lg:top-24">
          <OrderSummary
            items={typedCartItems}
            subtotal={subtotal}
            discountAmount={discountAmount}
            giftCardAmount={giftCardAmount}
            shipping={shipping}
            tax={tax}
            total={total}
            discountCode={discountCode}
            giftCardCode={giftCardCode}
          />
        </div>
      </div>
    </form>
  );
}

export default function CheckoutPhase1() {
  return <CheckoutForm />;
}