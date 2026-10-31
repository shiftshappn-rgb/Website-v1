import { redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-packs-new";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { PackForm } from "~/components/admin/PackForm";
import { db, isDatabaseAvailable } from "~/db.server";
import {
  listCatalogProductsForPacks,
  parsePackProductEntries,
  savePackProducts,
} from "~/lib/packs-admin.server";
import { requireAdmin } from "~/lib/session.server";
import { slugify } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) return { dbAvailable: false as const };
  await requireAdmin(request);
  return {
    dbAvailable: true as const,
    catalog: await listCatalogProductsForPacks(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) return { error: "Database is not configured." };
  await requireAdmin(request);

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || slugify(name);
  const description = String(formData.get("description") ?? "").trim() || null;
  const discountType =
    String(formData.get("discountType") ?? "fixed") === "percent" ? "percent" : "fixed";
  const discountValue = Number(formData.get("discountValue") ?? 0);
  const status = String(formData.get("status") ?? "draft") === "active" ? "active" : "draft";
  const entries = parsePackProductEntries(formData);

  if (!name) return { error: "Bundle name is required." };
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    return { error: "Discount must be zero or more." };
  }
  if (entries.length < 2) return { error: "Add at least two products." };
  if (entries.filter((entry) => entry.isPrimary).length !== 1) {
    return { error: "Mark exactly one product as primary." };
  }

  try {
    const pack = await db.pack.create({
      data: { name, slug, description, discountType, discountValue, status },
    });
    await savePackProducts(pack.id, entries);
    return redirect(`/admin/packs/${pack.id}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("products")) {
      return { error: error.message };
    }
    return { error: "That slug is already used. Choose another." };
  }
}

export default function AdminPacksNew({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  if (!loaderData.dbAvailable) return <DatabaseUnavailable />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-serif text-2xl text-navy">Create bundle</h1>
      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {actionData.error}
        </div>
      )}
      <PackForm catalog={loaderData.catalog} submitLabel="Create bundle" />
    </div>
  );
}
