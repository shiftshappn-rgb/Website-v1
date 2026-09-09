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
