import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-colors";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Card } from "~/components/ui/Badge";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import {
  listCatalogColors,
  parseColorHex,
} from "~/lib/catalog-colors.server";
import { requireAdmin } from "~/lib/session.server";
import { slugify } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);
  const colors = await listCatalogColors();
  return { dbAvailable: true as const, colors };
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
    if (!id) return { error: "Colour is required." };
    await db.catalogColor.delete({ where: { id } });
    return redirect("/admin/colors");
  }

  const name = String(formData.get("name") ?? "").trim();
  const hex = parseColorHex(String(formData.get("hex") ?? ""));
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0;
  const slugInput = String(formData.get("slug") ?? "").trim();

  if (!name) {
    return { error: "Colour name is required." };
  }
  if (!hex) {
    return { error: "Use a 6-digit hex colour, like #B07A7A." };
  }

  const slug = slugInput || slugify(name);

  if (intent === "update") {
    const id = String(formData.get("id") ?? "");
    const previous = await db.catalogColor.findUnique({ where: { id } });
    if (!previous) {
      return { error: "Colour not found." };
    }

    await db.catalogColor.update({
      where: { id },
      data: { name, slug, hex, sortOrder },
    });

    if (previous.name !== name || previous.hex !== hex) {
      await db.productVariant.updateMany({
        where: { colorName: previous.name },
        data: { colorName: name, colorHex: hex },
      });
    }

    return redirect("/admin/colors");
  }

  const duplicate = await db.catalogColor.findFirst({
    where: { OR: [{ name }, { slug }] },
  });
  if (duplicate) {
    return { error: "A colour with that name already exists." };
  }

  await db.catalogColor.create({
    data: { name, slug, hex, sortOrder },
  });

  return redirect("/admin/colors");
}

export default function AdminColors({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { colors } = loaderData;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif text-navy">Colours</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Add a colour once, then pick it when you create product variants.
          </p>
        </div>
      </div>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {actionData.error}
        </div>
      )}

      <Card>
        <h2 className="mb-4 font-medium text-navy">Add colour</h2>
        <Form method="post" className="grid gap-4 sm:grid-cols-[auto_1fr_8rem_auto] sm:items-end">
          <input type="hidden" name="intent" value="create" />
          <HexField name="hex" defaultValue="#B07A7A" />
          <Input label="Name" name="name" required placeholder="Dusty Rose" />
          <Input label="Sort" name="sortOrder" type="number" defaultValue={colors.length} />
          <Button type="submit">Save colour</Button>
        </Form>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-charcoal/10 bg-sand/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Colour</th>
              <th className="px-4 py-3 text-left font-medium">Hex</th>
              <th className="px-4 py-3 text-left font-medium">Sort</th>
              <th className="px-4 py-3 text-left font-medium">Edit</th>
              <th className="px-4 py-3 text-left font-medium">Delete</th>
            </tr>
          </thead>
          <tbody>
            {colors.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-charcoal/60">
                  No colours yet. Add Dusty Rose or any new fabric colour above.
                </td>
              </tr>
            ) : (
              colors.map((color) => (
                <tr key={color.id} className="border-b border-charcoal/5">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-medium text-navy">
                      <span
                        className="size-7 rounded-full border border-charcoal/15"
                        style={{ backgroundColor: color.hex }}
                        aria-hidden
                      />
                      {color.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-charcoal/70">{color.hex}</td>
                  <td className="px-4 py-3 text-charcoal/60">{color.sortOrder}</td>
                  <td className="px-4 py-3">
                    <details className="text-sm">
                      <summary className="cursor-pointer text-navy hover:text-terracotta">
                        Edit
                      </summary>
                      <Form method="post" className="mt-2 space-y-2 rounded-lg border border-charcoal/10 bg-sand/30 p-3">
                        <input type="hidden" name="intent" value="update" />
                        <input type="hidden" name="id" value={color.id} />
                        <HexField name="hex" defaultValue={color.hex} id={`hex-${color.id}`} />
                        <Input name="name" label="Name" defaultValue={color.name} required />
                        <Input name="slug" label="Slug" defaultValue={color.slug} />
                        <Input
                          name="sortOrder"
                          label="Sort"
                          type="number"
                          defaultValue={color.sortOrder}
                        />
                        <Button type="submit" size="sm">
                          Update
                        </Button>
                      </Form>
                    </details>
                  </td>
                  <td className="px-4 py-3">
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={color.id} />
                      <Button type="submit" size="sm" variant="outline" className="text-red-700">
                        Delete
                      </Button>
                    </Form>
                    <p className="mt-1 text-[11px] text-charcoal/45">Removes from this list only</p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-charcoal/55">
        After you save a colour, open a product and click the swatch to add it as a variant.{" "}
        <Link to="/admin/products" className="text-navy underline underline-offset-4 hover:text-terracotta">
          Go to products
        </Link>
      </p>
    </div>
  );
}

function HexField({
  name,
  defaultValue,
  id,
}: {
  name: string;
  defaultValue: string;
  id?: string;
}) {
  const fieldId = id ?? name;
  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="block text-sm font-medium text-charcoal">
        Swatch
      </label>
      <input
        id={fieldId}
        name={name}
        type="color"
        defaultValue={defaultValue}
        className="size-11 cursor-pointer rounded-lg border border-charcoal/20 bg-white p-1"
        aria-label="Pick colour"
      />
    </div>
  );
}
