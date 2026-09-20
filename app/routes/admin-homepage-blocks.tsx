import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-homepage-blocks";
import { Button } from "~/components/ui/Button";
import { Input, Select, Textarea } from "~/components/ui/Input";
import { Badge, Card } from "~/components/ui/Badge";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { ProductGridBlockEditor } from "~/components/admin/ProductGridBlockEditor";
import type { ProductGridContent } from "~/components/homepage-blocks/types";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";
import type { HomepageBlockType } from "@prisma/client";
import { ProductStatus } from "@prisma/client";

const blockTypes: HomepageBlockType[] = [
  "hero",
  "marquee",
  "quickShopRow",
  "categoryDuo",
  "productGrid",
  "bundleBanner",
  "sizeFinderStrip",
  "fabricCallout",
  "brandStory",
  "reviewHighlight",
  "valuePropsRow",
  "giftCardBanner",
];

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const [blocks, catalogProducts] = await Promise.all([
    db.homepageBlock.findMany({
      orderBy: { order: "asc" },
    }),
    db.product.findMany({
      where: { status: ProductStatus.active },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    dbAvailable: true as const,
    catalogProducts,
    blocks: blocks.map((b) => ({
      id: b.id,
      type: b.type,
      order: b.order,
      isActive: b.isActive,
      content: JSON.stringify(b.content, null, 2),
      productGridContent:
        b.type === "productGrid" ? (b.content as ProductGridContent) : null,
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "toggle") {
    const id = String(formData.get("id") ?? "");
    const block = await db.homepageBlock.findUnique({ where: { id } });
    if (block) {
      await db.homepageBlock.update({
        where: { id },
        data: { isActive: !block.isActive },
      });
    }
    return redirect("/admin/homepage-blocks");
  }

  if (intent === "reorder") {
    const id = String(formData.get("id") ?? "");
    const direction = String(formData.get("direction") ?? "");
    const block = await db.homepageBlock.findUnique({ where: { id } });
    if (!block) return redirect("/admin/homepage-blocks");

    const swapBlock = await db.homepageBlock.findFirst({
      where: {
        order: direction === "up" ? { lt: block.order } : { gt: block.order },
      },
      orderBy: { order: direction === "up" ? "desc" : "asc" },
    });

    if (swapBlock) {
      const nextOrder = swapBlock.order;
      const previousOrder = block.order;
      await db.homepageBlock.update({
        where: { id: block.id },
        data: { order: nextOrder },
      });
      await db.homepageBlock.update({
        where: { id: swapBlock.id },
        data: { order: previousOrder },
      });
    }

    return redirect("/admin/homepage-blocks");
  }

  if (intent === "updateProductGrid") {
    const id = String(formData.get("id") ?? "");
    const headline = String(formData.get("headline") ?? "").trim();
    const layout = String(formData.get("layout") ?? "grid");
    const collectionSlug = String(formData.get("collectionSlug") ?? "").trim();
    const productSlugs = formData
      .getAll("productSlugs")
      .map((value) => String(value).trim())
      .filter(Boolean);

    if (!headline) {
      return { error: "Headline is required." };
    }

    await db.homepageBlock.update({
      where: { id },
      data: {
        content: {
          headline,
          layout: layout === "carousel" ? "carousel" : "grid",
          ...(collectionSlug ? { collectionSlug } : {}),
          ...(productSlugs.length ? { productSlugs } : {}),
        },
      },
    });

    return redirect("/admin/homepage-blocks");
  }

  if (intent === "update") {
    const id = String(formData.get("id") ?? "");
    const contentRaw = String(formData.get("content") ?? "{}");
    let content: unknown;
    try {
      content = JSON.parse(contentRaw);
    } catch {
      return { error: "Content must be valid JSON." };
    }

    await db.homepageBlock.update({
      where: { id },
      data: { content: content as object },
    });

    return redirect("/admin/homepage-blocks");
  }

  if (intent === "create") {
    const type = String(formData.get("type") ?? "") as HomepageBlockType;
    const maxOrder = await db.homepageBlock.aggregate({ _max: { order: true } });
    const order = (maxOrder._max.order ?? -1) + 1;

    await db.homepageBlock.create({
      data: { type, order, content: {}, isActive: false },
    });

    return redirect("/admin/homepage-blocks");
  }

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "");
    await db.homepageBlock.delete({ where: { id } });
    return redirect("/admin/homepage-blocks");
  }

  return { error: "Unknown action." };
}

export default function AdminHomepageBlocks({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { blocks, catalogProducts } = loaderData;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif text-navy">Homepage Blocks</h1>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <Card>
        <h2 className="mb-4 font-medium text-navy">Add Block</h2>
        <Form method="post" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="intent" value="create" />
          <Select label="Block Type" name="type" className="min-w-[200px]">
            {blockTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm">
            Add Block
          </Button>
        </Form>
      </Card>

      <div className="space-y-4">
        {blocks.length === 0 ? (
          <p className="text-charcoal/60">No homepage blocks configured.</p>
        ) : (
          blocks.map((block, index) => (
            <Card key={block.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-navy">{block.type}</span>
                  <Badge variant={block.isActive ? "success" : "default"}>
                    {block.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <span className="text-xs text-charcoal/50">Order: {block.order}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Form method="post">
                    <input type="hidden" name="intent" value="reorder" />
                    <input type="hidden" name="id" value={block.id} />
                    <input type="hidden" name="direction" value="up" />
                    <Button type="submit" size="sm" variant="ghost" className="min-w-11" disabled={index === 0}>
                      ↑
                    </Button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="reorder" />
                    <input type="hidden" name="id" value={block.id} />
                    <input type="hidden" name="direction" value="down" />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      className="min-w-11"
                      disabled={index === blocks.length - 1}
                    >
                      ↓
                    </Button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggle" />
                    <input type="hidden" name="id" value={block.id} />
                    <Button type="submit" size="sm" variant="outline" className="min-h-11">
                      Toggle
                    </Button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={block.id} />
                    <Button type="submit" size="sm" variant="outline" className="min-h-11 text-red-600">
                      Delete
                    </Button>
                  </Form>
                </div>
              </div>

              {block.type === "productGrid" && block.productGridContent ? (
                <ProductGridBlockEditor
                  blockId={block.id}
                  content={block.productGridContent}
                  catalogProducts={catalogProducts}
                />
              ) : (
                <Form method="post" className="space-y-3">
                  <input type="hidden" name="intent" value="update" />
                  <input type="hidden" name="id" value={block.id} />
                  <Textarea
                    label={`Content JSON (${block.type})`}
                    name="content"
                    defaultValue={block.content}
                    rows={6}
                    className="font-mono text-xs"
                  />
                  <Button type="submit" size="sm">
                    Save Content
                  </Button>
                </Form>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
