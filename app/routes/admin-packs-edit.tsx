import { Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-packs-edit";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { PackForm } from "~/components/admin/PackForm";
import { Badge } from "~/components/ui/Badge";
import { db, isDatabaseAvailable } from "~/db.server";
import {
  listCatalogProductsForPacks,
  parsePackProductEntries,
  resolvePackProducts,
  savePackProducts,
} from "~/lib/packs-admin.server";
import { requireAdmin } from "~/lib/session.server";
import { slugify } from "~/lib/utils";

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) return { dbAvailable: false as const };
  await requireAdmin(request);

  const pack = await db.pack.findUnique({
    where: { id: params.id },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: { select: { id: true, name: true, basePrice: true, status: true } },
          bundle: {
            include: {
              products: {
                include: {
                  product: { select: { id: true, name: true, basePrice: true, status: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!pack) throw new Response("Bundle not found", { status: 404 });

  const products = resolvePackProducts(pack.items);

  return {
    dbAvailable: true as const,
    catalog: await listCatalogProductsForPacks(),
    pack: {
      id: pack.id,
      name: pack.name,
      slug: pack.slug,
      description: pack.description,
      discountType: pack.discountType,
      discountValue: Number(pack.discountValue),
      status: pack.status,
      products: products.map((product) => ({
        productId: product.productId,
        isPrimary: product.isPrimary,
      })),
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) return { error: "Database is not configured." };
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "update");
  const id = params.id!;

  if (intent === "delete") {
    await db.pack.delete({ where: { id } });
    return redirect("/admin/packs");
  }

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
    await db.pack.update({
      where: { id },
      data: { name, slug, description, discountType, discountValue, status },
    });
    await savePackProducts(id, entries);
    return { success: "Bundle saved." };
  } catch (error) {
    if (error instanceof Error && /products|primary/i.test(error.message)) {
      return { error: error.message };
    }
    return { error: "That slug is already used. Choose another." };
  }
}

export default function AdminPacksEdit({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  if (!loaderData.dbAvailable) return <DatabaseUnavailable />;
  const { pack, catalog } = loaderData;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="mb-2 text-sm text-charcoal/55">
            <Link to="/admin/packs" className="hover:text-navy">
              Bundles
            </Link>
            <span className="px-1.5">/</span>
            <span className="text-navy">{pack.name}</span>
          </nav>
          <h1 className="font-serif text-2xl text-navy">{pack.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={pack.status === "active" ? "success" : "warning"}>{pack.status}</Badge>
          {pack.status === "active" && (
            <Link
              to={`/bundles/${pack.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-navy underline-offset-4 hover:underline"
            >
              View on storefront
            </Link>
          )}
        </div>
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

      <PackForm catalog={catalog} pack={pack} submitLabel="Save bundle" />
    </div>
  );
}
