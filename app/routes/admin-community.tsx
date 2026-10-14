import { Form, redirect } from "react-router";
import type { Route } from "./+types/admin-community";
import { Badge, Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";
import type { ReviewStatus } from "@prisma/client";

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function optionalText(value: FormDataEntryValue | null, max = 80) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, max);
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }
  await requireAdmin(request);
  const posts = await db.communityPost.findMany({ orderBy: { createdAt: "desc" } });
  return {
    dbAvailable: true as const,
    posts: posts.map((post) => ({
      ...post,
      createdAt: post.createdAt.toISOString(),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }
  await requireAdmin(request);
  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "save");

  if (!id) {
    return { error: "Invalid community action." };
  }

  if (intent === "delete") {
    await db.communityPost.delete({ where: { id } });
    return redirect("/admin/community");
  }

  const role = optionalText(formData.get("role"));
  const workplace = optionalText(formData.get("workplace"));
  const imageRaw = String(formData.get("image") ?? "").trim();
  if (imageRaw && !isHttpUrl(imageRaw)) {
    return { error: "Image must be an http or https URL." };
  }

  const details = {
    role,
    workplace,
    image: imageRaw || null,
  };

  if (intent === "save") {
    await db.communityPost.update({ where: { id }, data: details });
    return redirect("/admin/community");
  }

  if (intent === "approved" || intent === "rejected" || intent === "pending") {
    await db.communityPost.update({
      where: { id },
      data: { ...details, status: intent },
    });
    return redirect("/admin/community");
  }

  return { error: "Invalid community action." };
}

const statusVariant: Record<ReviewStatus, "default" | "success" | "warning" | "error"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

export default function AdminCommunity({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-navy">Community</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Shift stories from the storefront. Add a role, workplace, and photo, then approve a
          post to publish it.
        </p>
      </div>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <div className="space-y-4">
        {loaderData.posts.length === 0 ? (
          <p className="text-charcoal/60">No community posts yet.</p>
        ) : (
          loaderData.posts.map((post) => (
            <Card key={post.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-navy">{post.title}</p>
                  <p className="text-sm text-charcoal/60">
                    {post.authorName}
                    {post.role ? `, ${post.role}` : ""}
                    {post.workplace ? `, ${post.workplace}` : ""} ·{" "}
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={statusVariant[post.status]}>{post.status}</Badge>
              </div>
              <p className="text-sm text-charcoal/80">{post.body}</p>
              {post.image && (
                <img
                  src={post.image}
                  alt=""
                  className="max-h-48 w-full rounded-lg object-cover"
                />
              )}
              <Form method="post" className="space-y-3 border-t border-charcoal/10 pt-3">
                <input type="hidden" name="id" value={post.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    id={`role-${post.id}`}
                    label="Role"
                    name="role"
                    defaultValue={post.role ?? ""}
                    maxLength={80}
                  />
                  <Input
                    id={`workplace-${post.id}`}
                    label="Workplace"
                    name="workplace"
                    defaultValue={post.workplace ?? ""}
                    maxLength={80}
                  />
                </div>
                <Input
                  id={`image-${post.id}`}
                  label="Image URL"
                  name="image"
                  type="url"
                  defaultValue={post.image ?? ""}
                  placeholder="https://"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" name="intent" value="save" size="sm" variant="outline">
                    Save details
                  </Button>
                  {post.status !== "approved" && (
                    <Button type="submit" name="intent" value="approved" size="sm">
                      Approve
                    </Button>
                  )}
                  {post.status === "pending" && (
                    <Button
                      type="submit"
                      name="intent"
                      value="rejected"
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                    >
                      Reject
                    </Button>
                  )}
                  {post.status !== "pending" && (
                    <Button type="submit" name="intent" value="pending" size="sm" variant="ghost">
                      Reset to pending
                    </Button>
                  )}
                </div>
              </Form>
              <Form method="post">
                <input type="hidden" name="id" value={post.id} />
                <Button type="submit" name="intent" value="delete" size="sm" variant="ghost" className="text-red-700">
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
