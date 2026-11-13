import { Form, Link, data, redirect } from "react-router";
import type { Route } from "./+types/auth-reset-password";
import { AuthError, AuthShell } from "~/components/auth/AuthShell";
import { PasswordField } from "~/components/auth/PasswordField";
import { Button } from "~/components/ui/Button";
import { db, isDatabaseAvailable } from "~/db.server";
import {
  clearPasswordReset,
  findCustomerForResetToken,
} from "~/lib/password-reset.server";
import { buildMeta } from "~/lib/seo";
import {
  createCustomerSession,
  getCustomer,
  hashPassword,
} from "~/lib/session.server";
import { claimGuestOrdersByEmail } from "~/lib/claim-orders.server";
import { validatePasswordStrength } from "~/lib/auth-validation";
import { rateLimit } from "~/lib/checkout-security.server";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Reset password — shiftshappn",
    description: "Choose a new shiftshappn account password.",
    path: "/auth/reset-password",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const customer = await getCustomer(request);
  if (customer) throw redirect("/account");

  if (!isDatabaseAvailable()) {
    return { valid: false as const, token: "", dbAvailable: false as const };
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) {
    return { valid: false as const, token: "", dbAvailable: true as const };
  }

  const match = await findCustomerForResetToken(db, token);
  return {
    valid: Boolean(match) as boolean,
    token,
    dbAvailable: true as const,
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return data(
      { error: "Store unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const limited = await rateLimit(request, "auth-reset", {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return data({ error: limited.error }, { status: 429 });
  }

  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return data({ error: "Reset link is missing or invalid." }, { status: 400 });
  }
  const strengthError = validatePasswordStrength(password);
  if (strengthError) {
    return data({ error: strengthError }, { status: 400 });
  }
  if (password !== confirm) {
    return data({ error: "Passwords do not match." }, { status: 400 });
  }

  const customer = await findCustomerForResetToken(db, token);
  if (!customer) {
    return data(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  await db.customer.update({
    where: { id: customer.id },
    data: { passwordHash },
  });
  await clearPasswordReset(db, customer.id);
  await claimGuestOrdersByEmail(db, customer.id, customer.email);

  return createCustomerSession(customer.id, "/account");
}

export default function AuthResetPassword({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const error =
    actionData && "error" in actionData ? actionData.error : null;

  if (!loaderData.dbAvailable) {
    return (
      <AuthShell title="Reset password" subtitle="Store unavailable right now.">
        <AuthError message="Please try again later." />
      </AuthShell>
    );
  }

  if (!loaderData.valid) {
    return (
      <AuthShell
        title="Link expired"
        subtitle="This reset link is invalid or has expired."
        footer={
          <Link
            to="/auth/forgot-password"
            className="underline underline-offset-4 hover:text-navy"
          >
            Request a new reset link
          </Link>
        }
      >
        <p className="text-sm text-charcoal/70">
          For security, reset links only work once and expire after one hour.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick something you’ll remember — at least 8 characters."
      footer={
        <Link to="/auth/login" className="underline underline-offset-4 hover:text-navy">
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-5">
        {error ? <AuthError message={error} /> : null}

        <Form method="post" className="space-y-4">
          <input type="hidden" name="token" value={loaderData.token} />
          <PasswordField
            label="New password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            helperText="At least 8 characters"
          />
          <PasswordField
            label="Confirm password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
          />
          <Button type="submit" variant="terracotta" size="lg" className="w-full">
            Update password
          </Button>
        </Form>
      </div>
    </AuthShell>
  );
}
