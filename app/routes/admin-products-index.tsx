import type { Route } from "./+types/admin-products-index";
import { LinkButton } from "~/components/ui/Button";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { ProductsDataTable } from "~/components/admin/ProductsDataTable";
import { db, isDatabaseAvailable } from "~/db.server";
import { parseVariantImages } from "~/lib/utils";
import { requireAdmin } from "~/lib/session.server";
import type { ProductStatus } from "@prisma/client";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const products = await db.product.findMany({
    include: {
      category: { select: { name: true } },
      variants: { select: { images: true }, orderBy: { createdAt: "asc" } },
      _count: { select: { variants: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return {
    dbAvailable: true as const,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? null,
    products: products.map((p) => {
      let thumbnailPublicId: string | null = null;
      let thumbnailAlt = p.name;
      for (const variant of p.variants) {
        const image = parseVariantImages(variant.images)[0];
        if (image) {
          thumbnailPublicId = image.publicId;
          thumbnailAlt = image.altText || p.name;
          break;
        }
      }
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        basePrice: Number(p.basePrice),
        categoryName: p.category?.name ?? null,
        variantCount: p._count.variants,
        thumbnailPublicId,
        thumbnailAlt,
      };
    }),
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "bulk-delete") {
    const productIds = formData
      .getAll("productIds")
      .map((value) => String(value).trim())
      .filter(Boolean);

    if (productIds.length === 0) {
      return { error: "No products selected." };
    }

    let deleted = 0;
    let skipped = 0;

    for (const productId of productIds) {
      const soldVariant = await db.orderItem.findFirst({
        where: { productVariant: { productId } },
        select: { id: true },
      });
      if (soldVariant) {
        skipped += 1;
        continue;
      }
      await db.product.delete({ where: { id: productId } });
      deleted += 1;
    }

    if (deleted === 0 && skipped > 0) {
      return {
        error:
          "Selected products have order history and can’t be deleted. Set them inactive instead.",
      };
    }

    return {
      success:
        skipped > 0
          ? `Deleted ${deleted} product${deleted === 1 ? "" : "s"}. Skipped ${skipped} with order history.`
          : `Deleted ${deleted} product${deleted === 1 ? "" : "s"}.`,
    };
  }

  const productId = String(formData.get("productId") ?? "").trim();
  if (!productId) {
    return { error: "Product is required." };
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, status: true },
  });
  if (!product) {
    return { error: "Product not found." };
  }

  if (intent === "toggle-status") {
    const nextStatus: ProductStatus =
      product.status === "active" ? "archived" : "active";
    await db.product.update({
      where: { id: productId },
      data: { status: nextStatus },
    });
    return {
      success:
        nextStatus === "active"
          ? `${product.name} is now active.`
          : `${product.name} is now inactive.`,
    };
  }

  if (intent === "delete") {
    const soldVariant = await db.orderItem.findFirst({
      where: { productVariant: { productId } },
      select: { id: true },
    });
    if (soldVariant) {
      return {
        error:
          "This product has order history and can’t be deleted. Set it inactive instead.",
      };
    }

    await db.product.delete({ where: { id: productId } });
    return { success: `${product.name} was deleted.` };
  }

  return { error: "Unknown action." };
}

export default function AdminProductsIndex({ loaderData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { products, cloudName } = loaderData;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-2xl text-navy">Products</h1>
        <LinkButton href="/admin/products/new">New Product</LinkButton>
      </div>

      <ProductsDataTable products={products} cloudName={cloudName} />
    </div>
  );
}
