import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { sendPasswordResetEmail } from "~/lib/email.server";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Always returns a generic success shape so callers don't leak whether the email exists.
 */
export async function requestPasswordReset(
  db: PrismaClient,
  emailRaw: string
): Promise<{ ok: true }> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return { ok: true };

  const customer = await db.customer.findUnique({ where: { email } });

  // No account, or Google-only (no password) — still look like success.
  if (!customer?.passwordHash) {
    return { ok: true };
  }

  const token = createPasswordResetToken();
  const tokenHash = hashPasswordResetToken(token);
  const expires = new Date(Date.now() + RESET_TTL_MS);

  await db.customer.update({
    where: { id: customer.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: expires,
    },
  });

  const appUrl = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const resetUrl = `${appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

  const sent = await sendPasswordResetEmail({
    to: customer.email,
    resetUrl,
  });

  if (!sent) {
    // Roll back token so a failed send doesn't leave a usable reset sitting unused.
    await db.customer.update({
      where: { id: customer.id },
      data: {
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      },
    });
    throw new Error(
      "We couldn't send the reset email. Please try again later or contact support."
    );
  }

  return { ok: true };
}

export async function findCustomerForResetToken(
  db: PrismaClient,
  token: string
) {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const tokenHash = hashPasswordResetToken(trimmed);
  const customer = await db.customer.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { gt: new Date() },
    },
  });

  return customer;
}

export async function clearPasswordReset(db: PrismaClient, customerId: string) {
  await db.customer.update({
    where: { id: customerId },
    data: {
      passwordResetTokenHash: null,
      passwordResetExpires: null,
    },
  });
}
