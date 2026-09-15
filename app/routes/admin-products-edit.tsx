import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/admin-products-edit";
import { Button } from "~/components/ui/Button";
import { Input, Select, Textarea } from "~/components/ui/Input";
import { Badge, Card } from "~/components/ui/Badge";
import { CloudinaryUploadButton } from "~/components/admin/CloudinaryUploadButton";
import { AddVariantForm } from "~/components/admin/AddVariantForm";
import { ColorGroupsEditor } from "~/components/admin/ColorGroupsEditor";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import {
  VariantsEditor,
  type EditVariant,
} from "~/components/admin/VariantsEditor";
import { db, isDatabaseAvailable } from "~/db.server";
import { listCatalogColors } from "~/lib/catalog-colors.server";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { buildVariantSku, CATALOG_SIZES } from "~/lib/product-catalog";
import { requireAdmin } from "~/lib/session.server";
import {
  normalizeVariantImages,
  parseVariantImages,
  slugify,
  type VariantImage,
} from "~/lib/utils";
import { Prisma, type ProductStatus } from "@prisma/client";

type ActionResult = {
  error?: string;
  success?: string;
};

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function parseColorPayloads(formData: FormData) {
  const colorsJson = String(formData.get("colors") ?? "").trim();
  if (colorsJson) {
    try {
      const parsed = JSON.parse(colorsJson) as Array<{ name?: string; hex?: string }>;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((color) => ({
          name: String(color.name ?? "").trim(),
          hex: String(color.hex ?? "#000000").trim() || "#000000",
        }))
        .filter((color) => color.name);
    } catch {
      return [];
    }
  }

  const colorName = String(formData.get("colorName") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "#000000").trim() || "#000000";
  return colorName ? [{ name: colorName, hex: colorHex }] : [];
}

function parseSelectedSizes(formData: FormData) {
  const sizes = formData
    .getAll("sizes")
    .map((value) => String(value).trim())
    .filter(Boolean);
  if (sizes.length > 0) return [...new Set(sizes)];

  const single = String(formData.get("size") ?? "").trim();
  return single ? [single] : [];
}

/** Map of `colorName::size` → inventory qty from JSON payload. */
function parseInventoryMap(formData: FormData): Record<string, number> {
  const raw = String(formData.get("inventories") ?? "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const qty = typeof value === "number" ? value : parseInt(String(value), 10);
      if (!Number.isNaN(qty) && qty >= 0) result[key] = qty;
    }
    return result;
  } catch {
    return {};
  }
}

function groupVariantsByColor(variants: EditVariant[]) {
  const groups: Array<{
    colorName: string;
    colorHex: string;
    images: VariantImage[];
    variants: EditVariant[];
  }> = [];

  for (const variant of variants) {
    let group = groups.find((item) => item.colorName === variant.colorName);
    if (!group) {
      group = {
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        images: variant.images,
        variants: [],
      };
      groups.push(group);
    }
    group.variants.push(variant);
    if (variant.images.length > group.images.length) {
      group.images = variant.images;
    }
  }

  return groups;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const [product, categories, fabricTypes, catalogColors] = await Promise.all([
    db.product.findUnique({
      where: { id: params.id },
      include: { variants: { orderBy: { createdAt: "asc" } } },
    }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.fabricType.findMany({ orderBy: { name: "asc" } }),
    listCatalogColors(),
  ]);

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  return {
    dbAvailable: true as const,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? null,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription,
      status: product.status,
      basePrice: Number(product.basePrice),
      compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
      categoryId: product.categoryId,
      fabricTypeId: product.fabricTypeId,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      seoImage: product.seoImage,
      fitSummary: product.fitSummary,
      careInstructions: product.careInstructions,
      lengthGuide: product.lengthGuide,
      offerLengths: product.offerLengths,
      updatedAt: product.updatedAt.toISOString(),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        size: variant.size,
        sku: variant.sku,
        priceOverride: variant.priceOverride ? Number(variant.priceOverride) : null,
        inventoryQty: variant.inventoryQty,
        images: parseVariantImages(variant.images),
      })),
    },
    categories,
    fabricTypes,
    catalogColors,
  };
}

export async function action({ request, params }: Route.ActionArgs): Promise<ActionResult> {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "update-product");
  const productId = params.id!;

  if (intent === "delete-variant" || intent === "bulk-delete-variants") {
    const variantIds = [
      ...new Set(
        formData
          .getAll("variantId")
          .map((value) => String(value).trim())
          .filter(Boolean)
      ),
    ];

    if (variantIds.length === 0) {
      return { error: "Select at least one variant to delete." };
    }

    const variants = await db.productVariant.findMany({
      where: { productId, id: { in: variantIds } },
      select: { id: true, colorName: true, size: true },
    });

    let deleted = 0;
    const blocked: string[] = [];

    for (const variant of variants) {
      const sold = await db.orderItem.findFirst({
        where: { productVariantId: variant.id },
        select: { id: true },
      });
      if (sold) {
        blocked.push(`${variant.colorName} / ${variant.size}`);
        continue;
      }
      await db.productVariant.delete({ where: { id: variant.id } });
      deleted += 1;
    }

    if (deleted === 0 && blocked.length > 0) {
      return {
        error: `${blocked.join(", ")} ${blocked.length === 1 ? "has" : "have"} order history and can’t be deleted.`,
      };
    }
    if (blocked.length > 0) {
      return {
        success: `Deleted ${deleted} variant${deleted === 1 ? "" : "s"}. Skipped ${blocked.join(", ")} (order history).`,
      };
    }
    if (deleted === 1 && variants.length === 1) {
      return {
        success: `${variants[0].colorName} / ${variants[0].size} was deleted.`,
      };
    }
    return { success: `Deleted ${deleted} variants.` };
  }

  if (intent === "delete-color" || intent === "bulk-delete-colors") {
    const colorNames = [
      ...new Set(
        formData
          .getAll("colorName")
          .map((value) => String(value).trim())
          .filter(Boolean)
      ),
    ];

    if (colorNames.length === 0) {
      return { error: "Select at least one colour to delete." };
    }

    let deleted = 0;
    const blocked: string[] = [];

    for (const colorName of colorNames) {
      const sold = await db.orderItem.findFirst({
        where: { productVariant: { productId, colorName } },
        select: { id: true },
      });
      if (sold) {
        blocked.push(colorName);
        continue;
      }
      const result = await db.productVariant.deleteMany({
        where: { productId, colorName },
      });
      if (result.count > 0) deleted += 1;
    }

    if (deleted === 0 && blocked.length > 0) {
      return {
        error: `${blocked.join(", ")} ${blocked.length === 1 ? "has" : "have"} order history and can’t be deleted.`,
      };
    }
    if (blocked.length > 0) {
      return {
        success: `Deleted ${deleted} colour${deleted === 1 ? "" : "s"}. Skipped ${blocked.join(", ")} (order history).`,
      };
    }
    return {
      success:
        deleted === 1
          ? `${colorNames[0]} was deleted.`
          : `Deleted ${deleted} colours.`,
    };
  }

  if (intent === "update-color-images") {
    const colorName = String(formData.get("colorName") ?? "").trim();
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { name: true },
    });
    const fallbackAlt = [product?.name, colorName].filter(Boolean).join(" ");
    const parsed = normalizeVariantImages(formData.get("images"), fallbackAlt);

    if (!colorName) {
      return { error: "Colour is required to save images." };
    }
    if (parsed.error) {
      return { error: parsed.error };
    }

    const updated = await db.productVariant.updateMany({
      where: { productId, colorName },
      data: { images: parsed.images },
    });
    if (updated.count === 0) {
      return { error: "No variants found for that colour." };
    }
    return { success: "Images saved." };
  }

  if (intent === "add-variant") {
    const colorName = String(formData.get("colorName") ?? "").trim();
    const colorHex = String(formData.get("colorHex") ?? "#000000").trim();
    const size = String(formData.get("size") ?? "").trim();
    const priceOverrideRaw = String(formData.get("priceOverride") ?? "").trim();
    const inventoryQty = parseInt(String(formData.get("inventoryQty") ?? "0"), 10);

    if (!colorName || !size) {
      return { error: "Colour and size are required for new variants." };
    }

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { slug: true },
    });
    if (!product) {
      return { error: "Product not found." };
    }

    const sku = buildVariantSku(product.slug, colorName, size);

    const duplicate = await db.productVariant.findFirst({
      where: { productId, colorName, size },
    });
    if (duplicate) {
      return { error: "A variant with this colour and size already exists." };
    }

    const sibling = await db.productVariant.findFirst({
      where: { productId, colorName },
    });
    const images = sibling ? parseVariantImages(sibling.images) : [];

    try {
      await db.productVariant.create({
        data: {
          productId,
          colorName,
          colorHex,
          size,
          sku,
          priceOverride: priceOverrideRaw ? parseFloat(priceOverrideRaw) : null,
          inventoryQty: Number.isNaN(inventoryQty) ? 0 : inventoryQty,
          images,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { error: `SKU ${sku} already exists.` };
      }
      throw error;
    }

    return { success: `Variant added (${sku}).` };
  }

  if (intent === "add-color-sizes" || intent === "add-matrix") {
    const colors = parseColorPayloads(formData);
    const requestedSizes = parseSelectedSizes(formData);
    const defaultQty = parseInt(String(formData.get("inventoryQty") ?? "0"), 10);
    const fallbackQty = Number.isNaN(defaultQty) ? 0 : defaultQty;
    const inventoryByKey = parseInventoryMap(formData);

    if (colors.length === 0) {
      return { error: "Pick at least one colour." };
    }
    if (requestedSizes.length === 0) {
      return { error: "Pick at least one size." };
    }

    const product = await db.product.findUnique({
      where: { id: productId },
      select: {
        slug: true,
        variants: { select: { colorName: true, size: true, images: true, sku: true } },
      },
    });
    if (!product) {
      return { error: "Product not found." };
    }

    const existingKeys = new Set(
      product.variants.map((variant) => `${variant.colorName}::${variant.size}`)
    );
    const existingSkus = new Set(product.variants.map((variant) => variant.sku));

    type CreateRow = {
      productId: string;
      colorName: string;
      colorHex: string;
      size: string;
      sku: string;
      inventoryQty: number;
      images: ReturnType<typeof parseVariantImages>;
    };

    const toCreate: CreateRow[] = [];
    let skippedExisting = 0;

    for (const color of colors) {
      const sibling = product.variants.find((variant) => variant.colorName === color.name);
      const images = sibling ? parseVariantImages(sibling.images) : [];

      for (const size of requestedSizes) {
        if (existingKeys.has(`${color.name}::${size}`)) {
          skippedExisting += 1;
          continue;
        }
        const sku = buildVariantSku(product.slug, color.name, size);
        if (existingSkus.has(sku) || toCreate.some((row) => row.sku === sku)) {
          skippedExisting += 1;
          continue;
        }
        const key = `${color.name}::${size}`;
        const rowQty = inventoryByKey[key];
        toCreate.push({
          productId,
          colorName: color.name,
          colorHex: color.hex,
          size,
          sku,
          inventoryQty: rowQty ?? fallbackQty,
          images,
        });
        existingKeys.add(key);
        existingSkus.add(sku);
      }
    }

    if (toCreate.length === 0) {
      return {
        error:
          skippedExisting > 0
            ? "Those colour/size combinations already exist."
            : "Nothing to add.",
      };
    }

    let created = 0;
    const failedSkus: string[] = [];

    for (const row of toCreate) {
      try {
        await db.productVariant.create({
          data: {
            productId: row.productId,
            colorName: row.colorName,
            colorHex: row.colorHex,
            size: row.size,
            sku: row.sku,
            inventoryQty: row.inventoryQty,
            images: row.images as Prisma.InputJsonValue,
          },
        });
        created += 1;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          failedSkus.push(row.sku);
          continue;
        }
        throw error;
      }
    }

    if (created === 0) {
      return {
        error:
          failedSkus.length > 0
            ? `Couldn’t create variants — SKU already in use (${failedSkus.slice(0, 3).join(", ")}${failedSkus.length > 3 ? "…" : ""}).`
            : "Nothing was created.",
      };
    }

    const colourLabel =
      colors.length === 1
        ? colors[0].name
        : `${colors.length} colours`;
    const sizeLabel =
      requestedSizes.length === CATALOG_SIZES.length
        ? "all sizes"
        : requestedSizes.join(", ");
    const skippedNote =
      skippedExisting > 0 ? ` Skipped ${skippedExisting} existing.` : "";
    const failedNote =
      failedSkus.length > 0
        ? ` ${failedSkus.length} skipped (SKU conflict).`
        : "";

    return {
      success: `Added ${created} variant${created === 1 ? "" : "s"} (${colourLabel} × ${sizeLabel}).${skippedNote}${failedNote}`,
    };
  }

  if (intent === "update-variant") {
    const variantId = String(formData.get("variantId") ?? "");
    const colorName = String(formData.get("colorName") ?? "").trim();
    const colorHex = String(formData.get("colorHex") ?? "#000000").trim();
    const size = String(formData.get("size") ?? "").trim();
    const sku = String(formData.get("sku") ?? "").trim();
    const priceOverrideRaw = String(formData.get("priceOverride") ?? "").trim();
    const inventoryQty = parseInt(String(formData.get("inventoryQty") ?? "0"), 10);

    if (!colorName || !size || !sku) {
      return { error: "Colour, size, and SKU are required." };
    }

    const duplicate = await db.productVariant.findFirst({
      where: {
        productId,
        colorName,
        size,
        NOT: { id: variantId },
      },
    });
    if (duplicate) {
      return { error: "A variant with this colour and size already exists." };
    }

    try {
      await db.productVariant.update({
        where: { id: variantId },
        data: {
          colorName,
          colorHex,
          size,
          sku,
          priceOverride: priceOverrideRaw ? parseFloat(priceOverrideRaw) : null,
          inventoryQty: Number.isNaN(inventoryQty) ? 0 : inventoryQty,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { error: "SKU already exists." };
      }
      throw error;
    }

    return { success: "Variant updated." };
  }

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

  if (compareAtPrice != null && (Number.isNaN(compareAtPrice) || compareAtPrice < 0)) {
    return { error: "Compare-at price must be a valid number." };
  }

  const slugConflict = await db.product.findFirst({
    where: { slug, NOT: { id: productId } },
  });
  if (slugConflict) {
    return { error: "A product with this slug already exists." };
  }

  await db.product.update({
    where: { id: productId },
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

  return { success: "Product saved." };
}

export default function AdminProductsEdit({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { product, categories, fabricTypes, cloudName, catalogColors } = loaderData;
  const navigation = useNavigation();
  const savingProduct =
    navigation.state !== "idle" && navigation.formData?.get("intent") === "update-product";
  const colorGroups = groupVariantsByColor(product.variants);
  const primaryPublicId = colorGroups.find((group) => group.images[0])?.images[0]?.publicId ?? null;
  const statusVariant =
    product.status === "active" ? "success" : product.status === "archived" ? "default" : "warning";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm text-charcoal/60">
            <li>
              <Link to="/admin/products" className="hover:text-navy">
                Products
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="truncate text-navy">{product.name}</li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif text-2xl text-navy">{product.name}</h1>
            <p className="text-sm text-charcoal/60">
              Last updated {new Date(product.updatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant}>{product.status}</Badge>
            <Link
              to={`/products/${product.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-navy px-4 text-sm font-medium text-navy hover:bg-navy hover:text-white"
            >
              View on storefront
              <ExternalLink className="size-3.5" aria-hidden />
            </Link>
            <Button form="product-form" type="submit" disabled={savingProduct}>
              {savingProduct ? "Saving…" : "Save product"}
            </Button>
          </div>
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

      <Form
        id="product-form"
        method="post"
        className="space-y-6"
        key={`product-${product.id}-${product.updatedAt}`}
      >
        <input type="hidden" name="intent" value="update-product" />

        <Card className="space-y-4">
          <h2 className="font-serif text-lg text-navy">Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" name="name" defaultValue={product.name} required />
            <div className="space-y-1">
              <Input label="Slug" name="slug" defaultValue={product.slug} />
              <p className="text-xs text-charcoal/55">
                Used in the storefront URL. Leave blank to generate from the name.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Select label="Status" name="status" defaultValue={product.status}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Select>
            <Input
              label="Base Price"
              name="basePrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product.basePrice}
              required
            />
            <Input
              label="Compare At Price"
              name="compareAtPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product.compareAtPrice ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" name="categoryId" defaultValue={product.categoryId ?? ""}>
              <option value="">None</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              label="Fabric Type"
              name="fabricTypeId"
              defaultValue={product.fabricTypeId ?? ""}
            >
              <option value="">None</option>
              {fabricTypes.map((fabric) => (
                <option key={fabric.id} value={fabric.id}>
                  {fabric.name}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-serif text-lg text-navy">Copy</h2>
          <Textarea
            label="Description"
            name="description"
            defaultValue={product.description}
            required
          />
          <Textarea
            label="Short Description"
            name="shortDescription"
            defaultValue={product.shortDescription ?? ""}
            rows={3}
            className="min-h-[80px]"
          />
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="font-serif text-lg text-navy">Fit, length & care</h2>
            <p className="mt-1 text-sm text-charcoal/60">
              Shown on the product page as Details, Fit, and Fabric tabs. Enable lengths
              for pants that offer Jogger, Straight, and Tall.
            </p>
          </div>
          <Textarea
            label="Fit"
            name="fitSummary"
            defaultValue={product.fitSummary ?? ""}
            rows={3}
            className="min-h-20"
          />
          <Textarea
            label="Care instructions"
            name="careInstructions"
            defaultValue={product.careInstructions ?? ""}
            rows={3}
            className="min-h-20"
          />
          <Input
            label="Length guide"
            name="lengthGuide"
            defaultValue={product.lengthGuide ?? ""}
            placeholder='Jogger 29" · Straight 31" · Tall 33"'
          />
          <label className="flex min-h-11 items-center gap-3 text-sm text-charcoal">
            <input
              type="checkbox"
              name="offerLengths"
              defaultChecked={product.offerLengths}
              className="size-4 rounded border-charcoal/30"
            />
            Offer Jogger / Straight / Tall on the product page
          </label>
        </Card>

        <Card>
          <details className="group">
            <summary className="cursor-pointer list-none font-serif text-lg text-navy">
              SEO
              <span className="ml-2 text-sm font-sans text-charcoal/50 group-open:hidden">
                (show)
              </span>
              <span className="ml-2 hidden text-sm font-sans text-charcoal/50 group-open:inline">
                (hide)
              </span>
            </summary>
            <div className="mt-4 space-y-4">
              <Input label="SEO Title" name="seoTitle" defaultValue={product.seoTitle ?? ""} />
              <Textarea
                label="SEO Description"
                name="seoDescription"
                defaultValue={product.seoDescription ?? ""}
                rows={2}
                className="min-h-[60px]"
              />
              <SeoImageField
                defaultValue={product.seoImage ?? ""}
                cloudName={cloudName}
                primaryPublicId={primaryPublicId}
              />
            </div>
          </details>
        </Card>
      </Form>

      <Card className="space-y-6">
        <div>
          <h2 className="font-serif text-lg text-navy">Media</h2>
          <p className="mt-1 text-sm text-charcoal/60">
            Upload photos per colour. Every size of that colour uses the same gallery on the
            storefront.
          </p>
        </div>
        {colorGroups.length === 0 ? (
          <p className="rounded-lg bg-sand/70 px-4 py-3 text-sm text-charcoal/70">
            Add a colour and size below before uploading photos.
          </p>
        ) : (
          <ColorGroupsEditor groups={colorGroups} productName={product.name} cloudName={cloudName} />
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-serif text-lg text-navy">Variants</h2>
        {product.variants.length > 0 && (
          <VariantsEditor
            key={product.variants.map((variant) => variant.id).join("-")}
            variants={product.variants}
          />
        )}
        <AddVariantForm
          key={`add-${product.variants.length}-${product.updatedAt}`}
          productSlug={product.slug}
          catalogColors={catalogColors}
          existingVariants={product.variants.map((variant) => ({
            colorName: variant.colorName,
            size: variant.size,
          }))}
        />
      </Card>

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-charcoal/10 bg-sand/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:-mx-8 lg:px-8">
        <Link to="/admin/products" className="text-sm text-charcoal/60 hover:text-navy">
          Back to products
        </Link>
        <Button form="product-form" type="submit" disabled={savingProduct}>
          {savingProduct ? "Saving…" : "Save product"}
        </Button>
      </div>
    </div>
  );
}

function SeoImageField({
  defaultValue,
  cloudName,
  primaryPublicId,
}: {
  defaultValue: string;
  cloudName: string | null;
  primaryPublicId: string | null;
}) {
  const [value, setValue] = useState(defaultValue);
  const preview = cloudinaryImageUrl(value, cloudName, 400);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-charcoal">SEO image</p>
      <input type="hidden" name="seoImage" value={value} />
      {preview ? (
        <img src={preview} alt="" className="h-32 w-32 rounded-lg object-cover" />
      ) : value ? (
        <p className="text-xs text-charcoal/50">{value}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <CloudinaryUploadButton
          cloudName={cloudName}
          label={value ? "Replace SEO image" : "Upload SEO image"}
          onUpload={(publicId) => setValue(publicId)}
        />
        {primaryPublicId && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setValue(primaryPublicId)}>
            Use primary product image
          </Button>
        )}
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setValue("")}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
