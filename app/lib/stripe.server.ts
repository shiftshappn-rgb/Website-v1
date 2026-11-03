import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripe = new Stripe(key, { apiVersion: "2026-07-29.dahlia" });
  }
  return stripe;
}

export function getStripePublishableKey(): string {
  return process.env.STRIPE_PUBLISHABLE_KEY ?? "";
}

export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export async function createCheckoutPaymentIntent(input: {
  amountCad: number;
  email: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.PaymentIntent> {
  const stripeClient = getStripe();
  const amount = dollarsToCents(input.amountCad);
  if (amount < 50) {
    throw new Error("Payment amount must be at least $0.50 CAD.");
  }

  return stripeClient.paymentIntents.create({
    amount,
    currency: "cad",
    receipt_email: input.email || undefined,
    automatic_payment_methods: { enabled: true },
    metadata: {
      source: "checkout_payment",
      email: input.email,
      ...(input.metadata ?? {}),
    },
  });
}

export async function retrieveSucceededPaymentIntent(
  paymentIntentId: string,
  expectedAmountCents: number
): Promise<Stripe.PaymentIntent> {
  const stripeClient = getStripe();
  const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status !== "succeeded") {
    throw new Error(`Payment not completed (status: ${paymentIntent.status}).`);
  }

  if (paymentIntent.amount !== expectedAmountCents) {
    throw new Error("Paid amount does not match order total.");
  }

  if (paymentIntent.currency !== "cad") {
    throw new Error("Unexpected payment currency.");
  }

  return paymentIntent;
}
