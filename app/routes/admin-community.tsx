import { Form, redirect } from "react-router";
import type { Route } from "./+types/admin-community";
import { Badge, Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";
import type { ReviewStatus } from "@prisma/client";

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
  const intent = String(formData.get("intent") ?? "update-status");

  if (!id) {
    return { error: "Invalid community action." };
  }

  if (intent === "delete") {
    await db.communityPost.delete({ where: { id } });
    return redirect("/admin/community");
  }

  const status = String(formData.get("status") ?? "") as ReviewStatus;
  if (!["approved", "rejected", "pending"].includes(status)) {
    return { error: "Invalid community action." };
  }
  await db.communityPost.update({ where: { id }, data: { status } });
  return redirect("/admin/community");
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
          Shift stories from the storefront. Approve a post to publish it.
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
                    {post.authorName} · {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={statusVariant[post.status]}>{post.status}</Badge>
              </div>
              <p className="text-sm text-charcoal/80">{post.body}</p>
              <div className="flex flex-wrap gap-2 border-t border-charcoal/10 pt-3">
                {post.status === "pending" && (
                  <>
                    <Form method="post">
                      <input type="hidden" name="id" value={post.id} />
                      <input type="hidden" name="status" value="approved" />
                      <Button type="submit" size="sm">
                        Approve
                      </Button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="id" value={post.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <Button type="submit" size="sm" variant="outline" className="text-red-600">
                        Reject
                      </Button>
                    </Form>
                  </>
                )}
                {post.status !== "pending" && (
                  <Form method="post">
                    <input type="hidden" name="id" value={post.id} />
                    <input type="hidden" name="status" value="pending" />
                    <Button type="submit" size="sm" variant="ghost">
                      Reset to pending
                    </Button>
                  </Form>
                )}
                <Form method="post">
                  <input type="hidden" name="id" value={post.id} />
                  <input type="hidden" name="intent" value="delete" />
                  <Button type="submit" size="sm" variant="ghost" className="text-red-700">
                    Delete
                  </Button>
                </Form>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
