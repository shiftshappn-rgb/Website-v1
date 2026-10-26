import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-packs";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Input, Select, Textarea } from "~/components/ui/Input";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";
import { slugify } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) return { dbAvailable: false as const };
  await requireAdmin(request);

  const [packs, sets, products] = await Promise.all([
    db.pack.findMany({
      orderBy: { name: "asc" },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            bundle: { select: { id: true, name: true } },
            product: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.bundle.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    dbAvailable: true as const,
    sets,
    products,
    packs: packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      slug: pack.slug,
      description: pack.description,
      discountType: pack.discountType,
      discountValue: Number(pack.discountValue),
      status: pack.status,
      setId: pack.items.find((item) => item.bundle)?.bundle?.id ?? "",
      setName: pack.items.find((item) => item.bundle)?.bundle?.name ?? "",
      productIds: pack.items.flatMap((item) => (item.product ? [item.product.id] : [])),
      extraNames: pack.items.flatMap((item) => (item.product ? [item.product.name] : [])),
    })),
  };
}

async function saveItems(packId: string, setId: string, productIds: string[]) {
  await db.packItem.deleteMany({ where: { packId } });
  await db.packItem.create({
    data: { packId, bundleId: setId, sortOrder: 0 },
  });
  if (productIds.length > 0) {
    await db.packItem.createMany({
      data: productIds.map((productId, index) => ({
        packId,
        productId,
        sortOrder: index + 1,
      })),
    });
  }
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) return { error: "Database is not configured." };
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "create");

  if (intent === "delete") {
    await db.pack.delete({ where: { id: String(formData.get("id") ?? "") } });
    return redirect("/admin/packs");
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || slugify(name);
  const description = String(formData.get("description") ?? "").trim() || null;
  const discountType = String(formData.get("discountType") ?? "fixed") === "percent" ? "percent" : "fixed";
  const discountValue = Number(formData.get("discountValue") ?? 0);
  const status = String(formData.get("status") ?? "draft") === "active" ? "active" : "draft";
  const setId = String(formData.get("setId") ?? "");
  const productIds = [...new Set(formData.getAll("productIds").map(String).filter(Boolean))];

  if (!name) return { error: "Bundle name is required." };
  if (!setId) return { error: "Choose the scrub set included in this bundle." };
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    return { error: "Discount must be zero or more." };
  }

  const data = { name, slug, description, discountType, discountValue, status } as const;

  try {
    if (intent === "update") {
      const id = String(formData.get("id") ?? "");
      await db.pack.update({ where: { id }, data });
      await saveItems(id, setId, productIds);
    } else {
      const pack = await db.pack.create({ data });
      await saveItems(pack.id, setId, productIds);
    }
  } catch {
    return { error: "That slug is already used. Choose another." };
  }

  return redirect("/admin/packs");
}

export default function AdminPacks({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) return <DatabaseUnavailable />;
  const { packs, sets, products } = loaderData;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl text-navy">Bundles</h1>
      <p className="text-sm text-charcoal/70">
        A bundle is one scrub set plus extras such as bottles, caps, or bags. Create those extras as
        active products in the Accessories category first.
      </p>
      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <Card>
        <h2 className="mb-4 font-medium text-navy">Create bundle</h2>
        <PackForm sets={sets} products={products} />
      </Card>

      <div className="space-y-4">
        {packs.length === 0 ? (
          <p className="text-charcoal/60">No bundles yet.</p>
        ) : (
          packs.map((pack) => (
            <Card key={pack.id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-serif text-lg text-navy">{pack.name}</h3>
                  <p className="text-sm text-charcoal/60">
                    {pack.slug} · {pack.status} · {pack.setName || "No set"}
                    {pack.extraNames.length > 0 ? ` · ${pack.extraNames.join(", ")}` : ""}
                  </p>
                </div>
                {pack.status === "active" && (
                  <Link
                    to={`/bundles/${pack.slug}`}
                    className="text-sm text-navy hover:text-terracotta"
                    target="_blank"
                  >
                    View on site
                  </Link>
                )}
              </div>
              <details>
                <summary className="cursor-pointer text-sm text-navy hover:text-terracotta">
                  Edit bundle
                </summary>
                <div className="mt-3">
                  <PackForm sets={sets} products={products} pack={pack} />
                </div>
              </details>
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={pack.id} />
                <Button type="submit" size="sm" variant="outline" className="text-red-600">
                  Delete bundle
                </Button>
              </Form>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function PackForm({
  sets,
  products,
  pack,
}: {
  sets: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  pack?: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    discountType: string;
    discountValue: number;
    status: string;
    setId: string;
    productIds: string[];
  };
}) {
  return (
    <Form method="post" className="space-y-4">
      <input type="hidden" name="intent" value={pack ? "update" : "create"} />
      {pack && <input type="hidden" name="id" value={pack.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" name="name" required defaultValue={pack?.name} />
        <Input label="Slug" name="slug" placeholder="auto-generated" defaultValue={pack?.slug} />
      </div>
      <Textarea
        label="Description"
        name="description"
        rows={2}
        className="min-h-[60px]"
        defaultValue={pack?.description ?? ""}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Discount" name="discountType" defaultValue={pack?.discountType ?? "fixed"}>
          <option value="fixed">Fixed amount off</option>
          <option value="percent">Percent off</option>
        </Select>
        <Input
          label="Discount value"
          name="discountValue"
          type="number"
          min="0"
          step="0.01"
          defaultValue={pack?.discountValue ?? 0}
        />
        <Select label="Status" name="status" defaultValue={pack?.status ?? "draft"}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
        </Select>
      </div>
      <Select label="Scrub set" name="setId" required defaultValue={pack?.setId ?? ""}>
        <option value="">Choose a set</option>
        {sets.map((set) => (
          <option key={set.id} value={set.id}>
            {set.name}
          </option>
        ))}
      </Select>
      <Select
        name="productIds"
        label="Extras (hold Ctrl or Cmd to select more than one)"
        multiple
        size={6}
        defaultValue={pack?.productIds ?? []}
        className="min-h-[120px]"
      >
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </Select>
      <Button type="submit">{pack ? "Save bundle" : "Create bundle"}</Button>
    </Form>
  );
}
