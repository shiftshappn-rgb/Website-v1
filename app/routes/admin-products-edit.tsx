import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Form, Link, useFetcher, useNavigation } from "react-router";
import type { Route } from "./+types/admin-products-edit";
import { Button } from "~/components/ui/Button";
import { Input, Select, Textarea } from "~/components/ui/Input";
import { Badge, Card } from "~/components/ui/Badge";
import { CloudinaryUploadButton } from "~/components/admin/CloudinaryUploadButton";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { VariantImageGallery } from "~/components/admin/VariantImageGallery";
import { db, isDatabaseAvailable } from "~/db.server";
import { listCatalogColors } from "~/lib/catalog-colors.server";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { CATALOG_SIZES } from "~/lib/product-catalog";
import { requireAdmin } from "~/lib/session.server";
import {
  cn,
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

type EditVariant = {
  id: string;
  colorName: string;
  colorHex: string;
  size: string;
  sku: string;
  priceOverride: number | null;
  inventoryQty: number;
  images: VariantImage[];
};

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

  if (intent === "delete-variant") {
    const variantId = String(formData.get("variantId") ?? "");
    await db.productVariant.delete({ where: { id: variantId } });
    return { success: "Variant deleted." };
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
    const sku = String(formData.get("sku") ?? "").trim();
    const priceOverrideRaw = String(formData.get("priceOverride") ?? "").trim();
    const inventoryQty = parseInt(String(formData.get("inventoryQty") ?? "0"), 10);

    if (!colorName || !size || !sku) {
      return { error: "Colour, size, and SKU are required for new variants." };
    }

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
        return { error: "SKU already exists." };
      }
      throw error;
    }

    return { success: "Variant added." };
  }

  if (intent === "add-color-sizes") {
    const colorName = String(formData.get("colorName") ?? "").trim();
    const colorHex = String(formData.get("colorHex") ?? "#000000").trim();
    const inventoryQty = parseInt(String(formData.get("inventoryQty") ?? "0"), 10);
    const qty = Number.isNaN(inventoryQty) ? 0 : inventoryQty;

    if (!colorName) {
      return { error: "Pick a colour first." };
    }

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { slug: true, variants: { select: { colorName: true, size: true, images: true } } },
    });
    if (!product) {
      return { error: "Product not found." };
    }

    const existingSizes = new Set(
      product.variants.filter((variant) => variant.colorName === colorName).map((variant) => variant.size)
    );
    const sibling = product.variants.find((variant) => variant.colorName === colorName);
    const images = sibling ? parseVariantImages(sibling.images) : [];
    const sizesToAdd = CATALOG_SIZES.filter((size) => !existingSizes.has(size));

    if (sizesToAdd.length === 0) {
      return { error: `${colorName} already has every size.` };
    }

    const colorSlug = slugify(colorName);
    try {
      await db.productVariant.createMany({
        data: sizesToAdd.map((size) => ({
          productId,
          colorName,
          colorHex,
          size,
          sku: `${product.slug}-${colorSlug}-${size}`.toLowerCase(),
          inventoryQty: qty,
          images,
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { error: "A SKU for this colour already exists. Add sizes one at a time." };
      }
      throw error;
    }

    return { success: `Added ${colorName} in ${sizesToAdd.join(", ")}.` };
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

      <Form id="product-form" method="post" className="space-y-6">
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
          colorGroups.map((group) => (
            <ColorMediaBlock
              key={group.colorName}
              colorName={group.colorName}
              colorHex={group.colorHex}
              images={group.images}
              productName={product.name}
              cloudName={cloudName}
            />
          ))
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-serif text-lg text-navy">Variants</h2>
        {product.variants.length > 0 && (
          <div className="space-y-3">
            <div className="hidden gap-3 text-xs font-medium uppercase tracking-wide text-charcoal/50 md:grid md:grid-cols-[1.2fr_5.5rem_1fr_6rem_6rem_auto]">
              <span>Colour</span>
              <span>Size</span>
              <span>SKU</span>
              <span>Inventory</span>
              <span>Price override</span>
              <span className="sr-only">Actions</span>
            </div>
            {product.variants.map((variant) => (
              <VariantRow key={variant.id} variant={variant} />
            ))}
          </div>
        )}
        <AddVariantForm catalogColors={catalogColors} />
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

function ColorMediaBlock({
  colorName,
  colorHex,
  images,
  productName,
  cloudName,
}: {
  colorName: string;
  colorHex: string;
  images: VariantImage[];
  productName: string;
  cloudName: string | null;
}) {
  const fetcher = useFetcher<ActionResult>();
  const saving = fetcher.state !== "idle";

  function persist(next: VariantImage[]) {
    const formData = new FormData();
    formData.set("intent", "update-color-images");
    formData.set("colorName", colorName);
    formData.set("images", JSON.stringify(next));
    fetcher.submit(formData, { method: "post" });
  }

  return (
    <div className="space-y-3 rounded-lg border border-charcoal/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="size-4 rounded-full border border-charcoal/15"
          style={{ backgroundColor: colorHex }}
          aria-hidden
        />
        <h3 className="font-medium text-navy">{colorName}</h3>
        {saving && <span className="text-xs text-charcoal/50">Saving…</span>}
        {fetcher.data?.success && fetcher.state === "idle" && (
          <span className="text-xs text-green-700">{fetcher.data.success}</span>
        )}
      </div>
      {fetcher.data?.error && (
        <p className="text-sm text-red-700" role="alert">
          {fetcher.data.error}
        </p>
      )}
      <VariantImageGallery
        images={images}
        cloudName={cloudName}
        defaultAlt={`${productName} ${colorName}`}
        onChange={persist}
      />
    </div>
  );
}

function VariantRow({ variant }: { variant: EditVariant }) {
  const fetcher = useFetcher<ActionResult>();
  const deleteFetcher = useFetcher<ActionResult>();
  const saving = fetcher.state !== "idle";
  const deleting = deleteFetcher.state !== "idle";

  return (
    <div className="rounded-lg border border-charcoal/10 p-3 md:border-0 md:p-0">
      <fetcher.Form
        method="post"
        className="grid gap-3 md:grid-cols-[1.2fr_5.5rem_1fr_6rem_6rem_auto] md:items-end"
      >
        <input type="hidden" name="intent" value="update-variant" />
        <input type="hidden" name="variantId" value={variant.id} />
        <ColorHexInput
          key={`${variant.id}-${variant.colorHex}`}
          name="colorName"
          hexName="colorHex"
          defaultName={variant.colorName}
          defaultHex={variant.colorHex}
          id={`color-${variant.id}`}
          compact
        />
        <Input
          id={`size-${variant.id}`}
          name="size"
          defaultValue={variant.size}
          required
          aria-label="Size"
        />
        <Input
          id={`sku-${variant.id}`}
          name="sku"
          defaultValue={variant.sku}
          required
          aria-label="SKU"
        />
        <Input
          id={`inventory-${variant.id}`}
          name="inventoryQty"
          type="number"
          defaultValue={variant.inventoryQty}
          aria-label="Inventory"
        />
        <Input
          id={`price-${variant.id}`}
          name="priceOverride"
          type="number"
          step="0.01"
          defaultValue={variant.priceOverride ?? ""}
          aria-label="Price override"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-red-700"
            disabled={deleting}
            onClick={() => {
              if (
                !confirm(
                  `Delete ${variant.colorName} / ${variant.size}? This cannot be undone.`
                )
              ) {
                return;
              }
              const formData = new FormData();
              formData.set("intent", "delete-variant");
              formData.set("variantId", variant.id);
              deleteFetcher.submit(formData, { method: "post" });
            }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </fetcher.Form>
      {(fetcher.data?.error || deleteFetcher.data?.error) && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {fetcher.data?.error || deleteFetcher.data?.error}
        </p>
      )}
    </div>
  );
}

function AddVariantForm({
  catalogColors,
}: {
  catalogColors: Array<{ id: string; name: string; hex: string }>;
}) {
  const fetcher = useFetcher<ActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const [formKey, setFormKey] = useState(0);
  const saving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      formRef.current?.reset();
      setFormKey((key) => key + 1);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <div className="rounded-lg border border-dashed border-charcoal/20 p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-navy">Add variant</h3>
        <Link
          to="/admin/colors"
          className="text-xs font-medium text-navy underline underline-offset-4 hover:text-terracotta"
        >
          Manage colours
        </Link>
      </div>
      <fetcher.Form ref={formRef} method="post" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <ColorHexInput
            key={formKey}
            name="colorName"
            hexName="colorHex"
            defaultName=""
            defaultHex="#B07A7A"
            palette={catalogColors}
          />
          <Input label="Size" name="size" required />
          <Input label="SKU" name="sku" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Inventory" name="inventoryQty" type="number" defaultValue="0" />
          <Input label="Price Override" name="priceOverride" type="number" step="0.01" />
        </div>
        {fetcher.data?.error && (
          <p className="text-sm text-red-700" role="alert">
            {fetcher.data.error}
          </p>
        )}
        {fetcher.data?.success && fetcher.state === "idle" && (
          <p className="text-sm text-green-700">{fetcher.data.success}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            variant="terracotta"
            name="intent"
            value="add-variant"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add variant"}
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            name="intent"
            value="add-color-sizes"
            formNoValidate
            disabled={saving}
          >
            Add colour in all sizes
          </Button>
        </div>
        <p className="text-xs text-charcoal/50">
          Click a saved swatch to fill the name. All sizes uses XXS–5XL.
        </p>
      </fetcher.Form>
    </div>
  );
}

function ColorHexInput({
  name,
  hexName,
  defaultName,
  defaultHex,
  id,
  compact = false,
  palette = [],
}: {
  name: string;
  hexName: string;
  defaultName: string;
  defaultHex: string;
  id?: string;
  compact?: boolean;
  palette?: Array<{ id: string; name: string; hex: string }>;
}) {
  const [hex, setHex] = useState(defaultHex);
  const [colorName, setColorName] = useState(defaultName);
  const safeHex = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#000000";
  const colorId = id ?? name;

  return (
    <div className="space-y-1">
      <label
        htmlFor={colorId}
        className={cn("block text-sm font-medium text-charcoal", compact && "md:sr-only")}
      >
        Colour
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safeHex}
          onChange={(event) => setHex(event.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded-lg border border-charcoal/20 bg-white p-1"
          aria-label="Pick colour"
        />
        <input type="hidden" name={hexName} value={safeHex} />
        <input
          id={colorId}
          name={name}
          value={colorName}
          onChange={(event) => setColorName(event.target.value)}
          required
          placeholder="Navy"
          className="w-full min-w-0 rounded-lg border border-charcoal/20 bg-white px-3 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
      </div>
      {palette.length > 0 && !compact ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {palette.map((color) => {
            const selected = colorName === color.name;
            return (
              <button
                key={color.id}
                type="button"
                title={color.name}
                onClick={() => {
                  setColorName(color.name);
                  setHex(color.hex);
                }}
                className={cn(
                  "size-11 rounded-full border transition-transform hover:scale-110",
                  selected ? "border-navy ring-2 ring-navy/30" : "border-charcoal/15"
                )}
                style={{ backgroundColor: color.hex }}
                aria-label={color.name}
              />
            );
          })}
        </div>
      ) : null}
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
