import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-categories";
import { Button } from "~/components/ui/Button";
import { Input, Select } from "~/components/ui/Input";
import { Card } from "~/components/ui/Badge";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { slugify } from "~/lib/utils";
import { requireAdmin } from "~/lib/session.server";

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentCategoryId: string | null;
  sortOrder: number;
  children: CategoryNode[];
};

function buildCategoryTree(
  categories: {
    id: string;
    name: string;
    slug: string;
    parentCategoryId: string | null;
    sortOrder: number;
  }[]
): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }

  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parentCategoryId && map.has(cat.parentCategoryId)) {
      map.get(cat.parentCategoryId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function CategoryRow({
  category,
  depth,
  allCategories,
}: {
  category: CategoryNode;
  depth: number;
  allCategories: { id: string; name: string }[];
}) {
  return (
    <>
      <tr className="border-b border-charcoal/5">
        <td className="px-4 py-3" style={{ paddingLeft: `${depth * 24 + 16}px` }}>
          <span className="font-medium text-navy">{category.name}</span>
          <span className="ml-2 text-xs text-charcoal/50">{category.slug}</span>
        </td>
        <td className="px-4 py-3 text-sm text-charcoal/60">{category.sortOrder}</td>
        <td className="px-4 py-3">
          <details className="text-sm">
            <summary className="cursor-pointer text-navy hover:text-terracotta">Edit</summary>
            <Form method="post" className="mt-2 space-y-2 rounded-lg border border-charcoal/10 bg-sand/30 p-3">
              <input type="hidden" name="intent" value="update" />
              <input type="hidden" name="id" value={category.id} />
              <Input name="name" defaultValue={category.name} label="Name" />
              <Input name="slug" defaultValue={category.slug} label="Slug" />
              <Input name="sortOrder" type="number" defaultValue={category.sortOrder} label="Sort Order" />
              <Select name="parentCategoryId" label="Parent" defaultValue={category.parentCategoryId ?? ""}>
                <option value="">None (root)</option>
                {allCategories
                  .filter((c) => c.id !== category.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
              <Button type="submit" size="sm">
                Save
              </Button>
            </Form>
          </details>
        </td>
        <td className="px-4 py-3">
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={category.id} />
            <Button type="submit" size="sm" variant="outline" className="text-red-600">
              Delete
            </Button>
          </Form>
        </td>
      </tr>
      {category.children.map((child) => (
        <CategoryRow
          key={child.id}
          category={child}
          depth={depth + 1}
          allCategories={allCategories}
        />
      ))}
    </>
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return {
    dbAvailable: true as const,
    tree: buildCategoryTree(categories),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
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
    await db.category.delete({ where: { id } });
    return redirect("/admin/categories");
  }

  if (intent === "update") {
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim() || slugify(name);
    const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10);
    const parentCategoryId = String(formData.get("parentCategoryId") ?? "").trim() || null;

    await db.category.update({
      where: { id },
      data: { name, slug, sortOrder, parentCategoryId },
    });
    return redirect("/admin/categories");
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || slugify(name);
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10);
  const parentCategoryId = String(formData.get("parentCategoryId") ?? "").trim() || null;

  if (!name) {
    return { error: "Category name is required." };
  }

  await db.category.create({
    data: { name, slug, sortOrder, parentCategoryId },
  });

  return redirect("/admin/categories");
}

export default function AdminCategories({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { tree, categories } = loaderData;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif text-navy">Categories</h1>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <Card>
        <h2 className="mb-4 font-medium text-navy">Create Category</h2>
        <Form method="post" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="intent" value="create" />
          <Input label="Name" name="name" required />
          <Input label="Slug" name="slug" placeholder="auto-generated" />
          <Input label="Sort Order" name="sortOrder" type="number" defaultValue="0" />
          <Select label="Parent" name="parentCategoryId">
            <option value="">None (root)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit">Create Category</Button>
          </div>
        </Form>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-charcoal/10 bg-sand/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Sort</th>
              <th className="px-4 py-3 text-left font-medium">Edit</th>
              <th className="px-4 py-3 text-left font-medium">Delete</th>
            </tr>
          </thead>
          <tbody>
            {tree.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-charcoal/60">
                  No categories yet.
                </td>
              </tr>
            ) : (
              tree.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  depth={0}
                  allCategories={categories}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
