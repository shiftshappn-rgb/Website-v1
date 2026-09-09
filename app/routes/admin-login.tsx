import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-login";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import {
  createAdminSession,
  getAdmin,
  verifyPassword,
} from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  const admin = await getAdmin(request);
  if (admin) {
    throw redirect("/admin");
  }

  return { dbAvailable: true as const };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const admin = await db.adminUser.findUnique({ where: { email } });
  if (!admin) {
    return { error: "Invalid email or password." };
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  return createAdminSession({
    id: admin.id,
    email: admin.email,
    role: admin.role,
  });
}

export default function AdminLogin({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  if (!loaderData.dbAvailable) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal p-4">
        <DatabaseUnavailable />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-center font-serif text-2xl text-navy">Admin Login</h1>
        <p className="mb-6 text-center text-sm text-charcoal/60">ShiftsHappn Admin Panel</p>

        {actionData?.error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-4">
          <Input label="Email" name="email" type="email" required autoComplete="email" />
          <Input
            label="Password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          <Button type="submit" className="w-full">
            Sign In
          </Button>
        </Form>
      </div>
    </div>
  );
}
