import { Link } from "react-router";
import type { Route } from "./+types/admin-blog-index";
import { Badge } from "~/components/ui/Badge";
import { LinkButton } from "~/components/ui/Button";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const posts = await db.blogPost.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return {
    dbAvailable: true as const,
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      author: p.author,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
    })),
  };
}

export default function AdminBlogIndex({ loaderData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { posts } = loaderData;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-serif text-navy">Blog</h1>
        <LinkButton href="/admin/blog/new">New Post</LinkButton>
      </div>

      <div className="overflow-x-auto rounded-xl border border-charcoal/10 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-charcoal/10 bg-sand/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Author</th>
              <th className="px-4 py-3 text-left font-medium">Published</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-charcoal/60">
                  No blog posts yet.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="border-b border-charcoal/5 hover:bg-sand/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-navy">{post.title}</div>
                    <div className="text-xs text-charcoal/50">{post.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={post.status === "published" ? "success" : "warning"}>
                      {post.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{post.author ?? "—"}</td>
                  <td className="px-4 py-3 text-charcoal/60">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/blog/${post.id}`}
                      className="text-navy hover:text-terracotta"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
