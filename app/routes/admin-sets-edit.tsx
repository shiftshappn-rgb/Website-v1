import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-sets-edit";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { SetForm } from "~/components/admin/SetForm";
import { Button } from "~/components/ui/Button";
import { isDatabaseAvailable } from "~/db.server";
import { normalizeRichTextForStorage } from "~/lib/rich-text";
import {
  deleteSet,
  getAdminSet,
  listCatalogProductsForSets,
  updateSet,
} from "~/lib/sets-admin.server";
import { requireAdmin } from "~/lib/session.server";
import { slugify } from "~/lib/utils";

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) return { dbAvailable: false as const };
  await requireAdmin(request);

  const set = await getAdminSet(params.id!);
  if (!set) throw new Response("Set not found", { status: 404 });

  const catalog = await listCatalogProductsForSets();
  return {
    dbAvailable: true as const,
    tops: catalog.tops,
    pants: catalog.pants,
    set,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) return { error: "Database is not configured." };
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "update");
  const id = params.id!;

  if (intent === "delete") {
    try {
      await deleteSet(id);
      return redirect("/admin/sets");
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not delete set.",
      };
    }
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || slugify(name);
  const description =
    normalizeRichTextForStorage(String(formData.get("description") ?? "")) || null;
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
    await updateSet(id, {
      name,
      slug,
      description,
      discountType,
      discountValue,
      topProductId,
      pantsProductId,
    });
    return { success: "Set saved." };
  } catch (error) {
    if (error instanceof Error) {
      if (/already|different|not a|could not be found/i.test(error.message)) {
        return { error: error.message };
      }
    }
    return { error: "That slug is already used. Choose another." };
  }
}

export default function AdminSetsEdit({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  if (!loaderData.dbAvailable) return <DatabaseUnavailable />;
  const { set, tops, pants } = loaderData;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="mb-2 text-sm text-charcoal/55">
            <Link to="/admin/sets" className="hover:text-navy">
              Sets
            </Link>
            <span className="px-1.5">/</span>
            <span className="text-navy">{set.name}</span>
          </nav>
          <h1 className="font-serif text-2xl text-navy">{set.name}</h1>
        </div>
        <Link
          to={`/sets/${set.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-navy underline-offset-4 hover:underline"
        >
          View on storefront
        </Link>
      </div>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {actionData.error}
        </div>
      )}
      {actionData?.success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          {actionData.success}
        </div>
      )}

      <SetForm
        tops={tops}
        pants={pants}
        set={set}
        submitLabel="Save set"
      />

      <section className="rounded-xl border border-red-200 bg-red-50/40 p-5">
        <h2 className="font-serif text-lg text-red-800">Delete set</h2>
        <p className="mt-1 text-sm text-red-800/80">
          {set.packCount > 0
            ? `Used by ${set.packCount} promo bundle(s). Remove those links before deleting.`
            : "Permanently removes this scrub set. Products stay in the catalogue."}
        </p>
        <Form method="post" className="mt-4">
          <input type="hidden" name="intent" value="delete" />
          <Button
            type="submit"
            variant="outline"
            className="border-red-600 text-red-700 hover:bg-red-600 hover:text-white"
            disabled={set.packCount > 0}
            onClick={(event) => {
              if (!confirm(`Delete “${set.name}”? This cannot be undone.`)) {
                event.preventDefault();
              }
            }}
          >
            Delete set
          </Button>
        </Form>
      </section>
    </div>
  );
}
