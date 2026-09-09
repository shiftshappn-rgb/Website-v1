import { Form, Link, redirect, data } from "react-router";
import type { Route } from "./+types/auth-login";
import { db } from "~/db.server";
import {
  createCustomerSession,
  getCustomer,
  verifyPassword,
} from "~/lib/session.server";
import { buildMeta } from "~/lib/seo";
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Sign in — shiftshappn",
    description: "Sign in to your shiftshappn account.",
    path: "/auth/login",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const customer = await getCustomer(request);
  if (customer) {
    throw redirect("/account");
  }
  return null;
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
    return data({ error: "Invalid email or password." }, { status: 401 });
  }

  const valid = await verifyPassword(password, customer.passwordHash);
  if (!valid) {
    return data({ error: "Invalid email or password." }, { status: 401 });
  }

  return createCustomerSession(customer.id, redirectTo);
}

export default function AuthLogin({ actionData }: Route.ComponentProps) {
  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <h1 className="text-3xl font-serif text-navy mb-2">Sign in</h1>
      <p className="text-charcoal/70 mb-8">
        Don't have an account?{" "}
        <Link to="/auth/register" className="text-navy underline underline-offset-4 hover:text-terracotta">
          Create one
        </Link>
      </p>

      {actionData?.error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="space-y-5">
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <Input label="Password" name="password" type="password" autoComplete="current-password" required />
        <Button type="submit" variant="terracotta" className="w-full">
          Sign in
        </Button>
      </Form>
    </div>
  );
}
