import { Form, Link } from "react-router";
import type { Route } from "./+types/admin-sets-index";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { Card } from "~/components/ui/Badge";
import { Button, LinkButton } from "~/components/ui/Button";
import { isDatabaseAvailable } from "~/db.server";
import { deleteSet, listAdminSets } from "~/lib/sets-admin.server";
import { requireAdmin } from "~/lib/session.server";
import { formatCurrency } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) return { dbAvailable: false as const };
  await requireAdmin(request);
  return {
    dbAvailable: true as const,
    sets: await listAdminSets(),
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
  if (!id) return { error: "Set is required." };

  try {
    await deleteSet(id);
    return { success: "Set deleted." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not delete set.",
    };
  }
}

export default function AdminSetsIndex({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) return <DatabaseUnavailable />;
  const { sets } = loaderData;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-navy">Sets</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Scrub sets bind a top and pants for the shop. Promo offers live under Bundles.
          </p>
        </div>
        <LinkButton href="/admin/sets/new">Create set</LinkButton>
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

      {sets.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-charcoal/70">No sets yet.</p>
          <p className="text-sm text-charcoal/55">
            Create a set from one top and one pants product. Shoppers buy it on /sets/…
          </p>
          <LinkButton href="/admin/sets/new">Create your first set</LinkButton>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-charcoal/10 bg-sand/40 text-charcoal/60">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Top</th>
                <th className="px-4 py-3 font-medium">Pants</th>
                <th className="px-4 py-3 font-medium">Sum</th>
                <th className="px-4 py-3 font-medium">Set price</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sets.map((set) => (
                <tr key={set.id} className="border-b border-charcoal/5 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/sets/${set.id}`}
                      className="font-medium text-navy hover:text-terracotta"
                    >
                      {set.name}
                    </Link>
                    <p className="text-xs text-charcoal/45">{set.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-charcoal/70">{set.topName}</td>
                  <td className="px-4 py-3 text-charcoal/70">{set.pantsName}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCurrency(set.sum)}</td>
                  <td className="px-4 py-3 font-medium tabular-nums text-navy">
                    {formatCurrency(set.sellPrice)}
                  </td>
                  <td className="px-4 py-3 text-charcoal/55">
                    {new Date(set.updatedAt).toLocaleDateString("en-CA", {
                      timeZone: "America/Halifax",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/admin/sets/${set.id}`}
                        className="text-sm font-medium text-navy underline-offset-4 hover:underline"
                      >
                        Edit
                      </Link>
                      <Link
                        to={`/sets/${set.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-charcoal/60 underline-offset-4 hover:underline"
                      >
                        View
                      </Link>
                      <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={set.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          aria-label={`Delete ${set.name}`}
                          onClick={(event) => {
                            if (
                              !confirm(
                                set.packCount > 0
                                  ? `“${set.name}” is used by ${set.packCount} promo bundle(s). Delete anyway only works after removing those links.`
                                  : `Delete “${set.name}”? This cannot be undone.`
                              )
                            ) {
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
