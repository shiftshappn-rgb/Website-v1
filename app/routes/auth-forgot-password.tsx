import { Form, Link, data, redirect } from "react-router";
import type { Route } from "./+types/auth-forgot-password";
import { AuthError, AuthShell } from "~/components/auth/AuthShell";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { db, isDatabaseAvailable } from "~/db.server";
import { requestPasswordReset } from "~/lib/password-reset.server";
import { buildMeta } from "~/lib/seo";
import { getCustomer } from "~/lib/session.server";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Forgot password — shiftshappn",
    description: "Reset your shiftshappn account password.",
    path: "/auth/forgot-password",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const customer = await getCustomer(request);
  if (customer) throw redirect("/account");
  return { dbAvailable: isDatabaseAvailable() };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return data(
      { error: "Store unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return data({ error: "Email is required." }, { status: 400 });
  }

  try {
    await requestPasswordReset(db, email);
    return { sent: true as const };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to send reset email. Please try again.";
    return data({ error: message }, { status: 500 });
  }
}

export default function AuthForgotPassword({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const sent = actionData && "sent" in actionData && actionData.sent;
  const error =
    actionData && "error" in actionData ? actionData.error : null;

  return (
    <AuthShell
      title="Forgot password"
      subtitle={
        sent
          ? "If an account with that email exists and uses a password, we’ve sent reset instructions."
          : "Enter the email on your account and we’ll send a reset link."
      }
      footer={
        <Link to="/auth/login" className="underline underline-offset-4 hover:text-navy">
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-5">
        {!loaderData.dbAvailable ? (
          <AuthError message="Store unavailable. Please try again later." />
        ) : null}
        {error ? <AuthError message={error} /> : null}

        {sent ? (
          <p className="text-sm text-charcoal/70">
            Check your inbox (and spam). The link expires in one hour. You can close this page.
          </p>
        ) : (
          <Form method="post" className="space-y-4">
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
            />
            <Button type="submit" variant="terracotta" size="lg" className="w-full">
              Send reset link
            </Button>
          </Form>
        )}
      </div>
    </AuthShell>
  );
}
