import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/admin-products-index";
import { Badge, Card } from "~/components/ui/Badge";
import { LinkButton } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { formatCurrency, parseVariantImages } from "~/lib/utils";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { requireAdmin } from "~/lib/session.server";
import type { ProductStatus } from "@prisma/client";

const statusVariant: Record<ProductStatus, "default" | "success" | "warning"> = {
  draft: "warning",
  active: "success",
  archived: "default",
};

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("q")?.trim() ?? "";

  const products = await db.product.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
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
    search,
  };
}

export default function AdminProductsIndex({ loaderData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();

  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { products, search, cloudName } = loaderData;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-serif text-navy">Products</h1>
        <LinkButton href="/admin/products/new">New Product</LinkButton>
      </div>

      <Card className="p-4">
        <form method="get" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Input
            name="q"
            placeholder="Search products..."
            defaultValue={search}
            className="flex-1"
          />
          <button
            type="submit"
            className="min-h-11 rounded-full bg-navy px-5 py-2 text-sm text-white hover:bg-navy/90"
          >
            Search
          </button>
          {searchParams.get("q") && (
            <Link to="/admin/products" className="inline-flex min-h-11 items-center text-sm text-charcoal/60 hover:text-navy">
              Clear
            </Link>
          )}
        </form>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-charcoal/10 bg-sand/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-charcoal">Name</th>
              <th className="px-4 py-3 text-left font-medium text-charcoal">Status</th>
              <th className="px-4 py-3 text-left font-medium text-charcoal">Price</th>
              <th className="hidden px-4 py-3 text-left font-medium text-charcoal md:table-cell">Category</th>
              <th className="hidden px-4 py-3 text-left font-medium text-charcoal md:table-cell">Variants</th>
              <th className="px-4 py-3 text-right font-medium text-charcoal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-charcoal/60">
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const thumbnailSrc = cloudinaryImageUrl(
                  product.thumbnailPublicId ?? "",
                  cloudName,
                  80
                );
                return (
                <tr key={product.id} className="border-b border-charcoal/5 hover:bg-sand/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {thumbnailSrc ? (
                        <img
                          src={thumbnailSrc}
                          alt={product.thumbnailAlt}
                          className="size-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="size-10 rounded-md bg-sand" aria-hidden />
                      )}
                      <div>
                        <div className="font-medium text-navy">{product.name}</div>
                        <div className="max-w-[140px] truncate text-xs text-charcoal/50">{product.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[product.status]}>{product.status}</Badge>
                  </td>
                  <td className="px-4 py-3">{formatCurrency(product.basePrice)}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{product.categoryName ?? "—"}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{product.variantCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/products/${product.id}`}
                      className="inline-flex min-h-11 items-center text-navy hover:text-terracotta"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
