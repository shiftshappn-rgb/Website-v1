import { Form, Link, redirect, data } from "react-router";
import type { Route } from "./+types/auth-register";
import { db } from "~/db.server";
import {
  createCustomerSession,
  getCustomer,
  hashPassword,
} from "~/lib/session.server";
import { buildMeta } from "~/lib/seo";
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Create account — shiftshappn",
    description: "Create your shiftshappn account.",
    path: "/auth/register",
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

  return createCustomerSession(customer.id);
}

export default function AuthRegister({ actionData }: Route.ComponentProps) {
  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <h1 className="text-3xl font-serif text-navy mb-2">Create account</h1>
      <p className="text-charcoal/70 mb-8">
        Already have an account?{" "}
        <Link to="/auth/login" className="text-navy underline underline-offset-4 hover:text-terracotta">
          Sign in
        </Link>
      </p>

      {actionData?.error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="space-y-5">
        <Input label="Name (optional)" name="name" autoComplete="name" />
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <label className="flex items-start gap-2 text-sm text-charcoal">
          <input type="checkbox" name="marketingOptIn" className="mt-1 rounded border-charcoal/20" />
          Send me updates about new products and offers
        </label>
        <Button type="submit" variant="terracotta" className="w-full">
          Create account
        </Button>
      </Form>
    </div>
  );
}
