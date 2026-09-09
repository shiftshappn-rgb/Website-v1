import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-collections";
import { Button } from "~/components/ui/Button";
import { Input, Select, Textarea } from "~/components/ui/Input";
import { Card } from "~/components/ui/Badge";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { slugify } from "~/lib/utils";
import { requireAdmin } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const [collections, products] = await Promise.all([
    db.collection.findMany({
      include: {
        products: {
          include: { product: { select: { id: true, name: true } } },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    dbAvailable: true as const,
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      heroImage: c.heroImage,
      productCount: c._count.products,
      products: c.products.map((pc) => ({
        productId: pc.productId,
        name: pc.product.name,
        sortOrder: pc.sortOrder,
      })),
    })),
    products,
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
    await db.collection.delete({ where: { id } });
    return redirect("/admin/collections");
  }

  if (intent === "assign-products") {
    const collectionId = String(formData.get("collectionId") ?? "");
    const productIds = formData.getAll("productIds").map(String);

    await db.productCollection.deleteMany({ where: { collectionId } });

    if (productIds.length > 0) {
      await db.productCollection.createMany({
        data: productIds.map((productId, index) => ({
          collectionId,
          productId,
          sortOrder: index,
        })),
      });
    }

    return redirect("/admin/collections");
  }

  if (intent === "update") {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim() || slugify(name);
    const description = String(formData.get("description") ?? "").trim() || null;
    const heroImage = String(formData.get("heroImage") ?? "").trim() || null;

    await db.collection.update({
      where: { id },
      data: { name, slug, description, heroImage },
    });
    return redirect("/admin/collections");
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || slugify(name);
  const description = String(formData.get("description") ?? "").trim() || null;
  const heroImage = String(formData.get("heroImage") ?? "").trim() || null;

  if (!name) {
    return { error: "Collection name is required." };
  }

  await db.collection.create({
    data: { name, slug, description, heroImage },
  });

  return redirect("/admin/collections");
}

export default function AdminCollections({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { collections, products } = loaderData;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif text-navy">Collections</h1>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <Card>
        <h2 className="mb-4 font-medium text-navy">Create Collection</h2>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="create" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" name="name" required />
            <Input label="Slug" name="slug" placeholder="auto-generated" />
          </div>
          <Textarea label="Description" name="description" rows={2} className="min-h-[60px]" />
          <Input label="Hero Image URL" name="heroImage" />
          <Button type="submit">Create Collection</Button>
        </Form>
      </Card>

      <div className="space-y-4">
        {collections.length === 0 ? (
          <p className="text-charcoal/60">No collections yet.</p>
        ) : (
          collections.map((collection) => (
            <Card key={collection.id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-serif text-lg text-navy">{collection.name}</h3>
                  <p className="text-sm text-charcoal/60">
                    {collection.slug} · {collection.productCount} products
                  </p>
                </div>
                <Link
                  to={`/collections/${collection.slug}`}
                  className="text-sm text-navy hover:text-terracotta"
                  target="_blank"
                >
                  View on site
                </Link>
              </div>

              <details>
                <summary className="cursor-pointer text-sm text-navy hover:text-terracotta">
                  Edit collection
                </summary>
                <Form method="post" className="mt-3 space-y-3">
                  <input type="hidden" name="intent" value="update" />
                  <input type="hidden" name="id" value={collection.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input name="name" label="Name" defaultValue={collection.name} />
                    <Input name="slug" label="Slug" defaultValue={collection.slug} />
                  </div>
                  <Textarea
                    name="description"
                    label="Description"
                    defaultValue={collection.description ?? ""}
                    rows={2}
                    className="min-h-[60px]"
                  />
                  <Input name="heroImage" label="Hero Image" defaultValue={collection.heroImage ?? ""} />
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </Form>
              </details>

              <details>
                <summary className="cursor-pointer text-sm text-navy hover:text-terracotta">
                  Assign products
                </summary>
                <Form method="post" className="mt-3 space-y-3">
                  <input type="hidden" name="intent" value="assign-products" />
                  <input type="hidden" name="collectionId" value={collection.id} />
                  <Select
                    name="productIds"
                    label="Products (hold Ctrl/Cmd to select multiple)"
                    multiple
                    size={6}
                    defaultValue={collection.products.map((p) => p.productId)}
                    className="min-h-[120px]"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" size="sm" variant="terracotta">
                    Update Products
                  </Button>
                </Form>
              </details>

              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={collection.id} />
                <Button type="submit" size="sm" variant="outline" className="text-red-600">
                  Delete Collection
                </Button>
              </Form>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
