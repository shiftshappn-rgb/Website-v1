import { Form, Link, redirect, data } from "react-router";
import type { Route } from "./+types/auth-login";
import { db } from "~/db.server";
import {
  createCustomerSession,
  getCustomer,
  verifyPassword,
} from "~/lib/session.server";
import { buildMeta } from "~/lib/seo";
import { isGoogleOAuthConfigured, safeRedirectPath } from "~/lib/google-auth.server";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";

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
    error: errorCode ? GOOGLE_ERRORS[errorCode] ?? "Sign-in failed. Please try again." : null,
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
        { error: "This account uses Google sign-in. Please continue with Google below." },
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
  const registerHref = redirectTo === "/account"
    ? "/auth/register"
    : `/auth/register?redirectTo=${encodeURIComponent(redirectTo)}`;
  const error = actionData?.error ?? loaderData?.error;

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <h1 className="text-3xl font-serif text-navy mb-2">Sign in</h1>
      <p className="text-charcoal/70 mb-8">
        Don&apos;t have an account?{" "}
        <Link to={registerHref} className="text-navy underline underline-offset-4 hover:text-terracotta">
          Create one
        </Link>
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loaderData?.googleAuthEnabled && (
        <div className="mb-6 space-y-4">
          <GoogleSignInButton redirectTo={redirectTo} />
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-charcoal/50">
            <div className="h-px flex-1 bg-charcoal/10" />
            <span>or</span>
            <div className="h-px flex-1 bg-charcoal/10" />
          </div>
        </div>
      )}

      <Form method="post" className="space-y-5">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <Input label="Password" name="password" type="password" autoComplete="current-password" required />
        <Button type="submit" variant="terracotta" className="w-full">
          Sign in
        </Button>
      </Form>
    </div>
  );
}
