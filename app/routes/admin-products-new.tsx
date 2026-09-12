import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-products-new";
import { Button } from "~/components/ui/Button";
import { Input, Select, Textarea } from "~/components/ui/Input";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { slugify } from "~/lib/utils";
import { requireAdmin } from "~/lib/session.server";
import type { ProductStatus } from "@prisma/client";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const [categories, fabricTypes] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.fabricType.findMany({ orderBy: { name: "asc" } }),
  ]);

  return {
    dbAvailable: true as const,
    categories,
    fabricTypes,
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || slugify(name);
  const description = String(formData.get("description") ?? "").trim();
  const shortDescription = String(formData.get("shortDescription") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "draft") as ProductStatus;
  const basePrice = parseFloat(String(formData.get("basePrice") ?? "0"));
  const compareAtPriceRaw = String(formData.get("compareAtPrice") ?? "").trim();
  const compareAtPrice = compareAtPriceRaw ? parseFloat(compareAtPriceRaw) : null;
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const fabricTypeId = String(formData.get("fabricTypeId") ?? "").trim() || null;
  const seoTitle = String(formData.get("seoTitle") ?? "").trim() || null;
  const seoDescription = String(formData.get("seoDescription") ?? "").trim() || null;
  const seoImage = String(formData.get("seoImage") ?? "").trim() || null;
  const fitSummary = String(formData.get("fitSummary") ?? "").trim() || null;
  const careInstructions = String(formData.get("careInstructions") ?? "").trim() || null;
  const lengthGuide = String(formData.get("lengthGuide") ?? "").trim() || null;
  const offerLengths = formData.get("offerLengths") === "on";

  if (!name || !description) {
    return { error: "Name and description are required." };
  }

  if (Number.isNaN(basePrice) || basePrice < 0) {
    return { error: "Base price must be a valid number." };
  }

  const existing = await db.product.findUnique({ where: { slug } });
  if (existing) {
    return { error: "A product with this slug already exists." };
  }

  const product = await db.product.create({
    data: {
      name,
      slug,
      description,
      shortDescription,
      status,
      basePrice,
      compareAtPrice,
      categoryId,
      fabricTypeId,
      seoTitle,
      seoDescription,
      seoImage,
      fitSummary,
      careInstructions,
      lengthGuide,
      offerLengths,
    },
  });

  return redirect(`/admin/products/${product.id}`);
}

export default function AdminProductsNew({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { categories, fabricTypes } = loaderData;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-serif text-navy">New Product</h1>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <Form method="post" className="space-y-6 rounded-xl border border-charcoal/10 bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" name="name" required />
          <Input label="Slug" name="slug" placeholder="auto-generated from name" />
        </div>

        <Textarea label="Description" name="description" required />
        <Textarea label="Short Description" name="shortDescription" rows={3} className="min-h-[80px]" />
        <Textarea label="Fit" name="fitSummary" rows={3} className="min-h-[80px]" />
        <Textarea label="Care instructions" name="careInstructions" rows={3} className="min-h-[80px]" />
        <Input
          label="Length guide"
          name="lengthGuide"
          placeholder='Jogger 29" · Straight 31" · Tall 33"'
        />
        <label className="flex min-h-11 items-center gap-3 text-sm text-charcoal">
          <input type="checkbox" name="offerLengths" className="size-4 rounded border-charcoal/30" />
          Offer Jogger / Straight / Tall on the product page
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Status" name="status" defaultValue="draft">
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
          <Input label="Base Price" name="basePrice" type="number" step="0.01" min="0" required />
          <Input label="Compare At Price" name="compareAtPrice" type="number" step="0.01" min="0" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Category" name="categoryId">
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Fabric Type" name="fabricTypeId">
            <option value="">None</option>
            {fabricTypes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>

        <fieldset className="space-y-4 rounded-lg border border-charcoal/10 p-4">
          <legend className="px-2 text-sm font-medium text-navy">SEO</legend>
          <Input label="SEO Title" name="seoTitle" />
          <Textarea label="SEO Description" name="seoDescription" rows={2} className="min-h-[60px]" />
          <Input label="SEO Image URL" name="seoImage" />
        </fieldset>

        <div className="flex gap-3">
          <Button type="submit">Create Product</Button>
          <Link
            to="/admin/products"
            className="inline-flex items-center justify-center rounded-full border border-navy px-5 py-2.5 text-sm font-medium text-navy hover:bg-navy hover:text-white"
          >
            Cancel
          </Link>
        </div>
      </Form>
    </div>
  );
}
