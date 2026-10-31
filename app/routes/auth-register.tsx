import { Form, Link, redirect, data } from "react-router";
import type { Route } from "./+types/auth-register";
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
  hashPassword,
} from "~/lib/session.server";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Create account — shiftshappn",
    description: "Create your shiftshappn account.",
    path: "/auth/register",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const redirectTo = safeRedirectPath(url.searchParams.get("redirectTo"));
  const customer = await getCustomer(request);
  if (customer) {
    throw redirect(redirectTo);
  }
  return { redirectTo, googleAuthEnabled: isGoogleOAuthConfigured() };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const marketingOptIn = formData.get("marketingOptIn") === "on";

  if (!email || !password) {
    return data({ error: "Email and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return data({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await db.customer.findUnique({ where: { email } });
  if (existing) {
    if (existing.googleId && !existing.passwordHash) {
      return data(
        {
          error: "An account with this email already exists. Sign in with Google instead.",
        },
        { status: 409 }
      );
    }
    return data({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const customer = await db.customer.create({
    data: {
      email,
      name: name || null,
      passwordHash,
      marketingOptIn,
    },
  });

  const redirectTo = safeRedirectPath(formData.get("redirectTo") as string | null);
  return createCustomerSession(customer.id, redirectTo);
}

export default function AuthRegister({ loaderData, actionData }: Route.ComponentProps) {
  const redirectTo = loaderData?.redirectTo ?? "/account";
  const loginHref =
    redirectTo === "/account"
      ? "/auth/login"
      : `/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`;

  return (
    <AuthShell
      title="Join the shift"
      subtitle={
        <>
          Create an account for faster checkout and order tracking. Already shopping with us?{" "}
          <Link
            to={loginHref}
            className="font-medium text-navy underline underline-offset-4 transition-colors hover:text-terracotta"
          >
            Sign in
          </Link>
        </>
      }
      footer={
        <p>
          By creating an account you agree to our{" "}
          <Link
            to="/policies/terms"
            className="underline underline-offset-4 hover:text-navy"
          >
            terms
          </Link>{" "}
          and{" "}
          <Link
            to="/policies/privacy"
            className="underline underline-offset-4 hover:text-navy"
          >
            privacy policy
          </Link>
          .
        </p>
      }
    >
      <div className="space-y-5">
        {actionData?.error ? <AuthError message={actionData.error} /> : null}

        {loaderData?.googleAuthEnabled ? (
          <div className="space-y-4">
            <GoogleSignInButton redirectTo={redirectTo} className="min-h-11" />
            <AuthDivider />
          </div>
        ) : null}

        <Form method="post" className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Input label="Name" name="name" autoComplete="name" placeholder="Optional" />
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
            autoComplete="new-password"
            minLength={8}
            helperText="At least 8 characters."
          />
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1 py-2 text-sm text-charcoal transition-colors hover:bg-sand/60">
            <input
              type="checkbox"
              name="marketingOptIn"
              className="mt-0.5 size-4 rounded border-charcoal/30 text-navy focus:ring-navy"
            />
            <span className="leading-snug text-charcoal/75">
              Send me product drops and offers — no spam, unsubscribe anytime.
            </span>
          </label>
          <Button type="submit" variant="terracotta" size="lg" className="w-full">
            Create account
          </Button>
        </Form>
      </div>
    </AuthShell>
  );
}
