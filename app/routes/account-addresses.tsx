import { Link, Form, data } from "react-router";
import type { Route } from "./+types/account-addresses";
import { requireCustomer } from "~/lib/session.server";
import { tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";
import {
  MAX_ADDRESS_COUNT,
  validateAddress,
} from "~/lib/validation";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Addresses — shiftshappn",
    description: "Manage your saved shipping addresses.",
    path: "/account/addresses",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { customer } = await requireCustomer(request);

  return {
    addresses: customer.addresses.map((a) => ({
      id: a.id,
      label: a.label,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      province: a.province,
      postalCode: a.postalCode,
      country: a.country,
      isDefault: a.isDefault,
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { customer } = await requireCustomer(request);
  const db = tryDb();
  if (!db) {
    return data({ error: "Database unavailable" }, { status: 503 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return data({ error: "Address not found." }, { status: 400 });
    await db.address.deleteMany({ where: { id, customerId: customer.id } });
    return { success: true };
  }

  if (intent === "setDefault") {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return data({ error: "Address not found." }, { status: 400 });
    const owned = await db.address.findFirst({
      where: { id, customerId: customer.id },
      select: { id: true },
    });
    if (!owned) {
      return data({ error: "Address not found." }, { status: 404 });
    }
    const addresses = await db.address.findMany({
      where: { customerId: customer.id },
      select: { id: true },
    });
    for (const address of addresses) {
      await db.address.update({
        where: { id: address.id },
        data: { isDefault: address.id === id },
      });
    }
    return { success: true };
  }

  const validated = validateAddress(
    {
      name: "Address",
      line1: String(formData.get("line1") ?? ""),
      line2: String(formData.get("line2") ?? ""),
      city: String(formData.get("city") ?? ""),
      province: String(formData.get("province") ?? ""),
      postalCode: String(formData.get("postalCode") ?? ""),
      country: String(formData.get("country") ?? "CA"),
    },
    { requireName: false, requirePhone: false }
  );
  if (!validated.ok) {
    return data(
      {
        error: Object.values(validated.fieldErrors)[0] ?? "Invalid address.",
        fieldErrors: validated.fieldErrors,
      },
      { status: 400 }
    );
  }

  const addressId = (formData.get("id") as string | null)?.trim() || null;
  if (!addressId) {
    const count = await db.address.count({ where: { customerId: customer.id } });
    if (count >= MAX_ADDRESS_COUNT) {
      return data(
        { error: `You can save up to ${MAX_ADDRESS_COUNT} addresses.` },
        { status: 400 }
      );
    }
  }

  const payload = {
    label: String(formData.get("label") ?? "").trim() || null,
    line1: validated.value.line1,
    line2: validated.value.line2 || null,
    city: validated.value.city,
    province: validated.value.province,
    postalCode: validated.value.postalCode,
    country: validated.value.country,
    isDefault: formData.get("isDefault") === "on",
  };

  if (addressId) {
    const owned = await db.address.findFirst({
      where: { id: addressId, customerId: customer.id },
      select: { id: true },
    });
    if (owned) {
      if (payload.isDefault) {
        const others = await db.address.findMany({
          where: { customerId: customer.id, NOT: { id: addressId } },
          select: { id: true },
        });
        for (const address of others) {
          await db.address.update({
            where: { id: address.id },
            data: { isDefault: false },
          });
        }
      }
      await db.address.update({
        where: { id: addressId },
        data: payload,
      });
    }
  } else {
    if (payload.isDefault) {
      const existing = await db.address.findMany({
        where: { customerId: customer.id },
        select: { id: true },
      });
      for (const address of existing) {
        await db.address.update({
          where: { id: address.id },
          data: { isDefault: false },
        });
      }
    }
    await db.address.create({
      data: { ...payload, customerId: customer.id },
    });
  }

  return { success: true };
}

export default function AccountAddresses({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { addresses } = loaderData;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <Link
        to="/account"
        className="text-sm text-navy hover:text-terracotta transition-colors"
      >
        ← Back to account
      </Link>

      <h1 className="text-3xl lg:text-4xl font-serif text-navy mt-4 mb-8">Addresses</h1>

      {actionData && "error" in actionData && actionData.error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm">
          {actionData.error}
        </div>
      )}

      {addresses.length > 0 && (
        <div className="space-y-4 mb-10">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="p-5 rounded-xl border border-charcoal/10 bg-white"
            >
              <div className="flex justify-between items-start">
                <div>
                  {address.label && (
                    <p className="text-sm font-medium text-navy">{address.label}</p>
                  )}
                  {address.isDefault && (
                    <span className="inline-block mt-1 text-xs bg-sand px-2 py-0.5 rounded text-charcoal/70">
                      Default
                    </span>
                  )}
                  <p className="mt-2 text-sm text-charcoal/80">
                    {address.line1}
                    {address.line2 && `, ${address.line2}`}
                    <br />
                    {address.city}, {address.province} {address.postalCode}
                    <br />
                    {address.country}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!address.isDefault && (
                    <Form method="post">
                      <input type="hidden" name="intent" value="setDefault" />
                      <input type="hidden" name="id" value={address.id} />
                      <button
                        type="submit"
                        className="text-xs text-navy hover:text-terracotta"
                      >
                        Set default
                      </button>
                    </Form>
                  )}
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={address.id} />
                    <button
                      type="submit"
                      className="text-xs text-charcoal/50 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </Form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-6 rounded-xl border border-charcoal/10 bg-white">
        <h2 className="font-serif text-lg text-navy mb-4">Add new address</h2>
        <Form method="post" className="space-y-4">
          <Input label="Label (optional)" name="label" placeholder="Home, Work..." />
          <Input label="Address line 1" name="line1" required />
          <Input label="Address line 2 (optional)" name="line2" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="City" name="city" required />
            <Input label="Province" name="province" required />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Postal code" name="postalCode" required />
            <Input label="Country" name="country" defaultValue="CA" />
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" name="isDefault" className="rounded border-charcoal/20" />
            Set as default address
          </label>
          <Button type="submit" variant="terracotta">
            Save address
          </Button>
        </Form>
      </div>
    </div>
  );
}
