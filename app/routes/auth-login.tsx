import { Form, Link, redirect, data } from "react-router";
import type { Route } from "./+types/auth-login";
import { AuthDivider, AuthError, AuthShell } from "~/components/auth/AuthShell";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";
import { PasswordField } from "~/components/auth/PasswordField";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { db } from "~/db.server";
import { isGoogleOAuthConfigured, safeRedirectPath } from "~/lib/google-auth.server";
import { buildMeta } from "~/lib/seo";
import {
  createCustomerSession,
  getCustomer,
  verifyPassword,
} from "~/lib/session.server";

const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in is not configured yet.",
  google_denied: "Google sign-in was cancelled.",
  google_state: "Google sign-in expired. Please try again.",
  google_failed: "Google sign-in failed. Please try again.",
};

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Sign in — shiftshappn",
    description: "Sign in to your shiftshappn account.",
    path: "/auth/login",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const redirectTo = safeRedirectPath(url.searchParams.get("redirectTo"));
  const errorCode = url.searchParams.get("error");
  const customer = await getCustomer(request);
  if (customer) {
    throw redirect(redirectTo);
  }
  return {
    redirectTo,
    googleAuthEnabled: isGoogleOAuthConfigured(),
    error: errorCode
      ? (GOOGLE_ERRORS[errorCode] ?? "Sign-in failed. Please try again.")
      : null,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/account";

  if (!email || !password) {
    return data({ error: "Email and password are required." }, { status: 400 });
  }

  const customer = await db.customer.findUnique({ where: { email } });
  if (!customer?.passwordHash) {
    if (customer?.googleId) {
      return data(
        {
          error: "This account uses Google sign-in. Please continue with Google below.",
        },
        { status: 401 }
      );
    }
    return data({ error: "Invalid email or password." }, { status: 401 });
  }

  const valid = await verifyPassword(password, customer.passwordHash);
  if (!valid) {
    return data({ error: "Invalid email or password." }, { status: 401 });
  }

  return createCustomerSession(customer.id, redirectTo);
}

export default function AuthLogin({ loaderData, actionData }: Route.ComponentProps) {
  const redirectTo = loaderData?.redirectTo ?? "/account";
  const registerHref =
    redirectTo === "/account"
      ? "/auth/register"
      : `/auth/register?redirectTo=${encodeURIComponent(redirectTo)}`;
  const error = actionData?.error ?? loaderData?.error;

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        <>
          Sign in to track orders and check out faster. New here?{" "}
          <Link
            to={registerHref}
            className="font-medium text-navy underline underline-offset-4 transition-colors hover:text-terracotta"
          >
            Create an account
          </Link>
        </>
      }
      footer={
        <Link to="/shop" className="underline underline-offset-4 hover:text-navy">
          Continue shopping
        </Link>
      }
    >
      <div className="space-y-5">
        {error ? <AuthError message={error} /> : null}

        {loaderData?.googleAuthEnabled ? (
          <div className="space-y-4">
            <GoogleSignInButton redirectTo={redirectTo} className="min-h-11" />
            <AuthDivider />
          </div>
        ) : null}

        <Form method="post" className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
          />
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
          />
          <Button type="submit" variant="terracotta" size="lg" className="w-full">
            Sign in
          </Button>
        </Form>
      </div>
    </AuthShell>
  );
}
