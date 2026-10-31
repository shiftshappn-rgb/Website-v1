import { Form, Link } from "react-router";
import type { Route } from "./+types/admin-packs-index";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { Badge, Card } from "~/components/ui/Badge";
import { Button, LinkButton } from "~/components/ui/Button";
import { db, isDatabaseAvailable } from "~/db.server";
import {
  packPricing,
  resolvePackProducts,
} from "~/lib/packs-admin.server";
import { requireAdmin } from "~/lib/session.server";
import { formatCurrency } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) return { dbAvailable: false as const };
  await requireAdmin(request);

  const packs = await db.pack.findMany({
    orderBy: { updatedAt: "desc" },
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

  return {
    dbAvailable: true as const,
    packs: packs.map((pack) => {
      const products = resolvePackProducts(pack.items);
      const pricing = packPricing(
        products,
        pack.discountType,
        Number(pack.discountValue)
      );
      const primary = products.find((product) => product.isPrimary) ?? products[0];
      return {
        id: pack.id,
        name: pack.name,
        slug: pack.slug,
        status: pack.status,
        productCount: products.length,
        primaryName: primary?.name ?? null,
        sum: pricing.sum,
        sellPrice: pricing.sellPrice,
        updatedAt: pack.updatedAt.toISOString(),
      };
    }),
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) return { error: "Database is not configured." };
  await requireAdmin(request);

  const formData = await request.formData();
  if (String(formData.get("intent") ?? "") !== "delete") {
    return { error: "Unknown action." };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Bundle is required." };

  await db.pack.delete({ where: { id } });
  return { success: "Bundle deleted." };
}

export default function AdminPacksIndex({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) return <DatabaseUnavailable />;
  const { packs } = loaderData;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-navy">Bundles</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Promotional groups of products with one primary item and a bundle discount.
          </p>
        </div>
        <LinkButton href="/admin/packs/new">Create bundle</LinkButton>
      </div>

      {actionData && "error" in actionData && actionData.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {actionData.error}
        </div>
      )}
      {actionData && "success" in actionData && actionData.success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          {actionData.success}
        </div>
      )}

      {packs.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-charcoal/70">No bundles yet.</p>
          <p className="text-sm text-charcoal/55">
            Create a bundle, add at least two products, mark a primary, then set your discount.
          </p>
          <LinkButton href="/admin/packs/new">Create bundle</LinkButton>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-charcoal/10 bg-sand/40 text-charcoal/60">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Products</th>
                <th className="px-4 py-3 font-medium">Primary</th>
                <th className="px-4 py-3 font-medium">Sum</th>
                <th className="px-4 py-3 font-medium">Bundle price</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => (
                <tr key={pack.id} className="border-b border-charcoal/5 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/packs/${pack.id}`}
                      className="font-medium text-navy hover:text-terracotta"
                    >
                      {pack.name}
                    </Link>
                    <p className="text-xs text-charcoal/45">{pack.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={pack.status === "active" ? "success" : "warning"}>
                      {pack.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{pack.productCount}</td>
                  <td className="px-4 py-3 text-charcoal/70">{pack.primaryName ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCurrency(pack.sum)}</td>
                  <td className="px-4 py-3 font-medium tabular-nums text-navy">
                    {formatCurrency(pack.sellPrice)}
                  </td>
                  <td className="px-4 py-3 text-charcoal/55">
                    {new Date(pack.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/admin/packs/${pack.id}`}
                        className="text-sm font-medium text-navy underline-offset-4 hover:underline"
                      >
                        Edit
                      </Link>
                      {pack.status === "active" && (
                        <Link
                          to={`/bundles/${pack.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-charcoal/60 underline-offset-4 hover:underline"
                        >
                          View
                        </Link>
                      )}
                      <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={pack.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={(event) => {
                            if (!confirm(`Delete “${pack.name}”? This cannot be undone.`)) {
                              event.preventDefault();
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
