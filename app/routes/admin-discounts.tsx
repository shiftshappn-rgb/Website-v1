import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-discounts";
import { Badge, Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Input, Select } from "~/components/ui/Input";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { formatCurrency } from "~/lib/utils";
import { requireAdmin } from "~/lib/session.server";
import type { DiscountType } from "@prisma/client";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const discounts = await db.discountCode.findMany({
    orderBy: { createdAt: "desc" },
  });

  return {
    dbAvailable: true as const,
    discounts: discounts.map((d) => ({
      id: d.id,
      code: d.code,
      type: d.type,
      value: Number(d.value),
      minSpend: d.minSpend ? Number(d.minSpend) : null,
      expiresAt: d.expiresAt?.toISOString().slice(0, 10) ?? null,
      usageLimit: d.usageLimit,
      usedCount: d.usedCount,
      isActive: d.isActive,
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "create");

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "");
    await db.discountCode.delete({ where: { id } });
    return redirect("/admin/discounts");
  }

  if (intent === "toggle") {
    const id = String(formData.get("id") ?? "");
    const discount = await db.discountCode.findUnique({ where: { id } });
    if (discount) {
      await db.discountCode.update({
        where: { id },
        data: { isActive: !discount.isActive },
      });
    }
    return redirect("/admin/discounts");
  }

  if (intent === "update") {
    const id = String(formData.get("id") ?? "");
    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    const type = String(formData.get("type") ?? "percent") as DiscountType;
    const value = parseFloat(String(formData.get("value") ?? "0"));
    const minSpendRaw = String(formData.get("minSpend") ?? "").trim();
    const minSpend = minSpendRaw ? parseFloat(minSpendRaw) : null;
    const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
    const usageLimitRaw = String(formData.get("usageLimit") ?? "").trim();
    const usageLimit = usageLimitRaw ? parseInt(usageLimitRaw, 10) : null;

    await db.discountCode.update({
      where: { id },
      data: { code, type, value, minSpend, expiresAt, usageLimit },
    });
    return redirect("/admin/discounts");
  }

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const type = String(formData.get("type") ?? "percent") as DiscountType;
  const value = parseFloat(String(formData.get("value") ?? "0"));
  const minSpendRaw = String(formData.get("minSpend") ?? "").trim();
  const minSpend = minSpendRaw ? parseFloat(minSpendRaw) : null;
  const expiresAtRaw = String(formData.get("expiresAt") ?? "").trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  const usageLimitRaw = String(formData.get("usageLimit") ?? "").trim();
  const usageLimit = usageLimitRaw ? parseInt(usageLimitRaw, 10) : null;

  if (!code) {
    return { error: "Discount code is required." };
  }

  const existing = await db.discountCode.findUnique({ where: { code } });
  if (existing) {
    return { error: "This discount code already exists." };
  }

  await db.discountCode.create({
    data: { code, type, value, minSpend, expiresAt, usageLimit },
  });

  return redirect("/admin/discounts");
}

function formatDiscountValue(type: DiscountType, value: number) {
  if (type === "percent") return `${value}%`;
  if (type === "free_shipping") return "Free shipping";
  return formatCurrency(value);
}

export default function AdminDiscounts({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { discounts } = loaderData;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif text-navy">Discount Codes</h1>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <Card>
        <h2 className="mb-4 font-medium text-navy">Create Discount</h2>
        <Form method="post" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="intent" value="create" />
          <Input label="Code" name="code" required placeholder="SUMMER20" />
          <Select label="Type" name="type" defaultValue="percent">
            <option value="percent">Percent</option>
            <option value="fixed">Fixed Amount</option>
            <option value="free_shipping">Free Shipping</option>
          </Select>
          <Input label="Value" name="value" type="number" step="0.01" required defaultValue="10" />
          <Input label="Min Spend" name="minSpend" type="number" step="0.01" />
          <Input label="Expires At" name="expiresAt" type="date" />
          <Input label="Usage Limit" name="usageLimit" type="number" min="1" />
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit">Create Discount</Button>
          </div>
        </Form>
      </Card>

      <div className="space-y-4">
        {discounts.length === 0 ? (
          <p className="text-charcoal/60">No discount codes yet.</p>
        ) : (
          discounts.map((discount) => (
            <Card key={discount.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-medium text-navy">{discount.code}</span>
                  <Badge variant={discount.isActive ? "success" : "default"}>
                    {discount.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <span className="text-sm text-charcoal/60">
                    {formatDiscountValue(discount.type, discount.value)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggle" />
                    <input type="hidden" name="id" value={discount.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Toggle
                    </Button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={discount.id} />
                    <Button type="submit" size="sm" variant="outline" className="text-red-600">
                      Delete
                    </Button>
                  </Form>
                </div>
              </div>
              <p className="text-xs text-charcoal/50">
                Used {discount.usedCount}
                {discount.usageLimit ? ` / ${discount.usageLimit}` : ""}
                {discount.expiresAt && ` · Expires ${discount.expiresAt}`}
              </p>
              <details>
                <summary className="cursor-pointer text-sm text-navy hover:text-terracotta">
                  Edit
                </summary>
                <Form method="post" className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="intent" value="update" />
                  <input type="hidden" name="id" value={discount.id} />
                  <Input name="code" label="Code" defaultValue={discount.code} />
                  <Select name="type" label="Type" defaultValue={discount.type}>
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="free_shipping">Free Shipping</option>
                  </Select>
                  <Input name="value" label="Value" type="number" step="0.01" defaultValue={discount.value} />
                  <Input
                    name="minSpend"
                    label="Min Spend"
                    type="number"
                    step="0.01"
                    defaultValue={discount.minSpend ?? ""}
                  />
                  <Input
                    name="expiresAt"
                    label="Expires At"
                    type="date"
                    defaultValue={discount.expiresAt ?? ""}
                  />
                  <Input
                    name="usageLimit"
                    label="Usage Limit"
                    type="number"
                    defaultValue={discount.usageLimit ?? ""}
                  />
                  <div className="sm:col-span-2">
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                  </div>
                </Form>
              </details>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
