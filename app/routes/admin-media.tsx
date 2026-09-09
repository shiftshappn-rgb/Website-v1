import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-media";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Card } from "~/components/ui/Badge";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const assets = await db.mediaAsset.findMany({
    orderBy: { uploadedAt: "desc" },
  });

  return {
    dbAvailable: true as const,
    assets: assets.map((a) => ({
      id: a.id,
      cloudinaryPublicId: a.cloudinaryPublicId,
      altText: a.altText,
      tags: a.tags,
      uploadedAt: a.uploadedAt.toISOString(),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "upload");

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "");
    await db.mediaAsset.delete({ where: { id } });
    return redirect("/admin/media");
  }

  const cloudinaryPublicId = String(formData.get("cloudinaryPublicId") ?? "").trim();
  const altText = String(formData.get("altText") ?? "").trim();
  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  if (!cloudinaryPublicId || !altText) {
    return { error: "Cloudinary public ID and alt text are required." };
  }

  const existing = await db.mediaAsset.findUnique({
    where: { cloudinaryPublicId },
  });
  if (existing) {
    return { error: "An asset with this public ID already exists." };
  }

  await db.mediaAsset.create({
    data: { cloudinaryPublicId, altText, tags },
  });

  return redirect("/admin/media");
}

export default function AdminMedia({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { assets } = loaderData;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif text-navy">Media Library</h1>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <Card>
        <h2 className="mb-4 font-medium text-navy">Upload Asset</h2>
        <p className="mb-4 text-sm text-charcoal/60">
          Register a Cloudinary asset by its public ID. Upload the file to Cloudinary separately,
          then add it here.
        </p>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="upload" />
          <Input
            label="Cloudinary Public ID"
            name="cloudinaryPublicId"
            required
            placeholder="shiftshappn/products/hero-scrub"
          />
          <Input label="Alt Text" name="altText" required placeholder="Describe the image" />
          <Input label="Tags (comma-separated)" name="tags" placeholder="product, hero" />
          <Button type="submit">Add Asset</Button>
        </Form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.length === 0 ? (
          <p className="col-span-full text-charcoal/60">No media assets yet.</p>
        ) : (
          assets.map((asset) => (
            <Card key={asset.id} className="space-y-3">
              <div className="aspect-video rounded-lg bg-sand flex items-center justify-center text-xs text-charcoal/40">
                {asset.cloudinaryPublicId}
              </div>
              <p className="text-sm font-medium text-navy">{asset.altText}</p>
              {asset.tags.length > 0 && (
                <p className="text-xs text-charcoal/50">{asset.tags.join(", ")}</p>
              )}
              <p className="text-xs text-charcoal/40">
                {new Date(asset.uploadedAt).toLocaleDateString()}
              </p>
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={asset.id} />
                <Button type="submit" size="sm" variant="outline" className="text-red-600">
                  Delete
                </Button>
              </Form>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
