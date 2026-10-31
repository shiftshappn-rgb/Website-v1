import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";

/** Opaque token required to view order confirmation by order number. */
export function createOrderAccessToken(orderNumber: string): string {
  return createHmac("sha256", SESSION_SECRET)
    .update(`order-access:v1:${orderNumber}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyOrderAccessToken(
  orderNumber: string,
  token: string | null | undefined
): boolean {
  if (!token || token.length < 16) return false;
  const expected = createOrderAccessToken(orderNumber);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function checkoutSuccessPath(orderNumber: string): string {
  const t = createOrderAccessToken(orderNumber);
  return `/checkout/success?session_id=${encodeURIComponent(orderNumber)}&t=${encodeURIComponent(t)}`;
}
