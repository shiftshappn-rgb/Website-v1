import { Link, Form, data } from "react-router";
import type { Route } from "./+types/account-addresses";
import { requireCustomer } from "~/lib/session.server";
import { tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";

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
    const id = formData.get("id") as string;
    await db.address.deleteMany({ where: { id, customerId: customer.id } });
    return { success: true };
  }

  if (intent === "setDefault") {
    const id = formData.get("id") as string;
    await db.address.updateMany({
      where: { customerId: customer.id },
      data: { isDefault: false },
    });
    await db.address.updateMany({
      where: { id, customerId: customer.id },
      data: { isDefault: true },
    });
    return { success: true };
  }

  const line1 = formData.get("line1") as string;
  const city = formData.get("city") as string;
  const province = formData.get("province") as string;
  const postalCode = formData.get("postalCode") as string;

  if (!line1 || !city || !province || !postalCode) {
    return data({ error: "Please fill in required fields." }, { status: 400 });
  }

  const addressId = formData.get("id") as string | null;
  const payload = {
    label: (formData.get("label") as string) || null,
    line1,
    line2: (formData.get("line2") as string) || null,
    city,
    province,
    postalCode,
    country: (formData.get("country") as string) || "CA",
    isDefault: formData.get("isDefault") === "on",
  };

  if (addressId) {
    await db.address.updateMany({
      where: { id: addressId, customerId: customer.id },
      data: payload,
    });
  } else {
    if (payload.isDefault) {
      await db.address.updateMany({
        where: { customerId: customer.id },
        data: { isDefault: false },
      });
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
