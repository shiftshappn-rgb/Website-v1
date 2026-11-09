import { Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-sets-new";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { SetForm } from "~/components/admin/SetForm";
import { isDatabaseAvailable } from "~/db.server";
import { createSet, listCatalogProductsForSets } from "~/lib/sets-admin.server";
import { requireAdmin } from "~/lib/session.server";
import { slugify } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) return { dbAvailable: false as const };
  await requireAdmin(request);
  const catalog = await listCatalogProductsForSets();
  return {
    dbAvailable: true as const,
    tops: catalog.tops,
    pants: catalog.pants,
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
  const topProductId = String(formData.get("topProductId") ?? "").trim();
  const pantsProductId = String(formData.get("pantsProductId") ?? "").trim();

  if (!name) return { error: "Set name is required." };
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    return { error: "Discount must be zero or more." };
  }
  if (!topProductId || !pantsProductId) {
    return { error: "Choose both a top and pants product." };
  }

  try {
    const set = await createSet({
      name,
      slug,
      description,
      discountType,
      discountValue,
      topProductId,
      pantsProductId,
    });
    return redirect(`/admin/sets/${set.id}`);
  } catch (error) {
    if (error instanceof Error) {
      if (/already|different|not a|could not be found/i.test(error.message)) {
        return { error: error.message };
      }
      if (/Unique constraint|slug/i.test(error.message)) {
        return { error: "That slug is already used. Choose another." };
      }
    }
    return { error: "That slug is already used. Choose another." };
  }
}

export default function AdminSetsNew({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  if (!loaderData.dbAvailable) return <DatabaseUnavailable />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <nav className="mb-2 text-sm text-charcoal/55">
          <Link to="/admin/sets" className="hover:text-navy">
            Sets
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-navy">New</span>
        </nav>
        <h1 className="font-serif text-2xl text-navy">Create set</h1>
      </div>
      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {actionData.error}
        </div>
      )}
      <SetForm
        tops={loaderData.tops}
        pants={loaderData.pants}
        submitLabel="Create set"
      />
    </div>
  );
}
