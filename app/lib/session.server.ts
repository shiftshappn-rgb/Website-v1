import { createCookieSessionStorage, redirect } from "react-router";
import bcrypt from "bcryptjs";
import type { AdminRole } from "@prisma/client";
import { db } from "~/db.server";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";

export const adminSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__admin_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  },
});

export const customerSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__customer_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  },
});

export type SessionAdmin = {
  id: string;
  email: string;
  role: AdminRole;
};

export async function getAdminSession(request: Request) {
  return adminSessionStorage.getSession(request.headers.get("Cookie"));
}

export async function getCustomerSession(request: Request) {
  return customerSessionStorage.getSession(request.headers.get("Cookie"));
}

function adminFromSession(session: Awaited<ReturnType<typeof getAdminSession>>): SessionAdmin | null {
  const adminId = session.get("adminId") as string | undefined;
  const email = session.get("adminEmail") as string | undefined;
  const role = session.get("adminRole") as AdminRole | undefined;
  if (!adminId || !email || !role) return null;
  return { id: adminId, email, role };
}

export async function requireAdmin(request: Request) {
  const session = await getAdminSession(request);
  const fromCookie = adminFromSession(session);
  if (fromCookie) {
    return { admin: fromCookie, session };
  }

  const adminId = session.get("adminId") as string | undefined;
  if (!adminId) {
    throw redirect("/admin/login");
  }

  const admin = await db.adminUser.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, role: true },
  });
  if (!admin) {
    throw redirect("/admin/login");
  }

  return { admin, session };
}

export async function getAdmin(request: Request) {
  const session = await getAdminSession(request);
  const fromCookie = adminFromSession(session);
  if (fromCookie) return fromCookie;

  const adminId = session.get("adminId") as string | undefined;
  if (!adminId) return null;

  return db.adminUser.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, role: true },
  });
}

export async function requireCustomer(request: Request) {
  const session = await getCustomerSession(request);
  const customerId = session.get("customerId") as string | undefined;
  if (!customerId) {
    throw redirect("/auth/login");
  }

  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: { addresses: true },
  });
  if (!customer) {
    throw redirect("/auth/login");
  }

  return { customer, session };
}

export async function getCustomer(request: Request) {
  const session = await getCustomerSession(request);
  const customerId = session.get("customerId") as string | undefined;
  if (!customerId) return null;

  return db.customer.findUnique({
    where: { id: customerId },
    include: { addresses: true },
  });
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createAdminSession(
  admin: { id: string; email: string; role: AdminRole },
  redirectTo = "/admin"
) {
  const session = await adminSessionStorage.getSession();
  session.set("adminId", admin.id);
  session.set("adminEmail", admin.email);
  session.set("adminRole", admin.role);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await adminSessionStorage.commitSession(session),
    },
  });
}

export async function destroyAdminSession(request: Request) {
  const session = await getAdminSession(request);
  return redirect("/admin/login", {
    headers: {
      "Set-Cookie": await adminSessionStorage.destroySession(session),
    },
  });
}

export async function createCustomerSession(
  customerId: string,
  redirectTo = "/account"
) {
  const session = await customerSessionStorage.getSession();
  session.set("customerId", customerId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await customerSessionStorage.commitSession(session),
    },
  });
}

export async function destroyCustomerSession(request: Request) {
  const session = await getCustomerSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await customerSessionStorage.destroySession(session),
    },
  });
}
