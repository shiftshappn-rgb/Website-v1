import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-settings";
import { Button } from "~/components/ui/Button";
import { Input, Textarea } from "~/components/ui/Input";
import { Card } from "~/components/ui/Badge";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";

const SETTING_KEYS = [
  "lowStockThreshold",
  "storeName",
  "supportEmail",
  "freeShippingThreshold",
  "announcementBanner",
] as const;

type SettingsMap = Record<(typeof SETTING_KEYS)[number], string>;

async function loadSettings(): Promise<SettingsMap> {
  const rows = await db.siteSetting.findMany({
    where: { key: { in: [...SETTING_KEYS] } },
  });

  const map: Partial<SettingsMap> = {};
  for (const row of rows) {
    const val = row.value;
    if (typeof val === "string" || typeof val === "number") {
      map[row.key as keyof SettingsMap] = String(val);
    } else if (typeof val === "object" && val !== null) {
      if ("threshold" in val) {
        map.lowStockThreshold = String((val as { threshold: number }).threshold);
      } else if ("text" in val) {
        map.announcementBanner = String((val as { text: string }).text);
      } else {
        map[row.key as keyof SettingsMap] = JSON.stringify(val);
      }
    }
  }

  return {
    lowStockThreshold: map.lowStockThreshold ?? "10",
    storeName: map.storeName ?? "ShiftsHappn",
    supportEmail: map.supportEmail ?? "",
    freeShippingThreshold: map.freeShippingThreshold ?? "100",
    announcementBanner: map.announcementBanner ?? "",
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const settings = await loadSettings();
  return { dbAvailable: true as const, settings };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
  const lowStockThreshold = parseInt(String(formData.get("lowStockThreshold") ?? "10"), 10);
  const storeName = String(formData.get("storeName") ?? "").trim();
  const supportEmail = String(formData.get("supportEmail") ?? "").trim();
  const freeShippingThreshold = parseFloat(
    String(formData.get("freeShippingThreshold") ?? "100")
  );
  const announcementBanner = String(formData.get("announcementBanner") ?? "").trim();

  const updates: { key: string; value: object | string | number }[] = [
    { key: "lowStockThreshold", value: { threshold: lowStockThreshold } },
    { key: "storeName", value: storeName },
    { key: "supportEmail", value: supportEmail },
    { key: "freeShippingThreshold", value: freeShippingThreshold },
    { key: "announcementBanner", value: { text: announcementBanner } },
  ];

  for (const { key, value } of updates) {
    await db.siteSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  return redirect("/admin/settings");
}

export default function AdminSettings({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { settings } = loaderData;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-serif text-navy">Site Settings</h1>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <Card>
        <Form method="post" className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="mb-2 font-medium text-navy">Inventory</legend>
            <Input
              label="Low Stock Threshold"
              name="lowStockThreshold"
              type="number"
              min="0"
              defaultValue={settings.lowStockThreshold}
              required
            />
            <p className="text-xs text-charcoal/50">
              Variants at or below this quantity appear on the dashboard low stock alert.
            </p>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-2 font-medium text-navy">Store</legend>
            <Input label="Store Name" name="storeName" defaultValue={settings.storeName} />
            <Input
              label="Support Email"
              name="supportEmail"
              type="email"
              defaultValue={settings.supportEmail}
            />
            <Input
              label="Free Shipping Threshold ($)"
              name="freeShippingThreshold"
              type="number"
              step="0.01"
              min="0"
              defaultValue={settings.freeShippingThreshold}
            />
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-2 font-medium text-navy">Announcements</legend>
            <Textarea
              label="Announcement Banner"
              name="announcementBanner"
              defaultValue={settings.announcementBanner}
              rows={2}
              className="min-h-[60px]"
              placeholder="Optional banner text shown on the storefront"
            />
          </fieldset>

          <Button type="submit">Save Settings</Button>
        </Form>
      </Card>
    </div>
  );
}
