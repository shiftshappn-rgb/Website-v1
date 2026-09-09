import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-blog-edit";
import { Button } from "~/components/ui/Button";
import { Input, Select, Textarea } from "~/components/ui/Input";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { slugify } from "~/lib/utils";
import { requireAdmin } from "~/lib/session.server";
import type { BlogStatus } from "@prisma/client";

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const post = await db.blogPost.findUnique({ where: { id: params.id } });
  if (!post) {
    throw new Response("Post not found", { status: 404 });
  }

  return {
    dbAvailable: true as const,
    post: {
      ...post,
      tags: post.tags.join(", "),
      publishedAt: post.publishedAt?.toISOString().slice(0, 16) ?? "",
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "update");

  if (intent === "delete") {
    await db.blogPost.delete({ where: { id: params.id } });
    return redirect("/admin/blog");
  }

  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || slugify(title);
  const excerpt = String(formData.get("excerpt") ?? "").trim() || null;
  const bodyRichText = String(formData.get("bodyRichText") ?? "").trim();
  const coverImage = String(formData.get("coverImage") ?? "").trim() || null;
  const author = String(formData.get("author") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "draft") as BlogStatus;
  const seoTitle = String(formData.get("seoTitle") ?? "").trim() || null;
  const seoDescription = String(formData.get("seoDescription") ?? "").trim() || null;
  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  if (!title || !bodyRichText) {
    return { error: "Title and body are required." };
  }

  const slugConflict = await db.blogPost.findFirst({
    where: { slug, NOT: { id: params.id } },
  });
  if (slugConflict) {
    return { error: "A post with this slug already exists." };
  }

  const existing = await db.blogPost.findUnique({ where: { id: params.id } });
  const publishedAt =
    status === "published"
      ? existing?.publishedAt ?? new Date()
      : null;

  await db.blogPost.update({
    where: { id: params.id },
    data: {
      title,
      slug,
      excerpt,
      bodyRichText,
      coverImage,
      author,
      status,
      publishedAt,
      seoTitle,
      seoDescription,
      tags,
    },
  });

  return redirect(`/admin/blog/${params.id}`);
}

export default function AdminBlogEdit({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { post } = loaderData;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-serif text-navy">Edit Blog Post</h1>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <Form method="post" className="space-y-6 rounded-xl border border-charcoal/10 bg-white p-6">
        <input type="hidden" name="intent" value="update" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Title" name="title" defaultValue={post.title} required />
          <Input label="Slug" name="slug" defaultValue={post.slug} required />
        </div>

        <Textarea label="Excerpt" name="excerpt" defaultValue={post.excerpt ?? ""} rows={2} className="min-h-[60px]" />
        <Textarea label="Body" name="bodyRichText" defaultValue={post.bodyRichText} required rows={12} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Cover Image URL" name="coverImage" defaultValue={post.coverImage ?? ""} />
          <Input label="Author" name="author" defaultValue={post.author ?? ""} />
        </div>

        <Select label="Status" name="status" defaultValue={post.status}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </Select>

        <Input label="Tags (comma-separated)" name="tags" defaultValue={post.tags} />

        <fieldset className="space-y-4 rounded-lg border border-charcoal/10 p-4">
          <legend className="px-2 text-sm font-medium text-navy">SEO</legend>
          <Input label="SEO Title" name="seoTitle" defaultValue={post.seoTitle ?? ""} />
          <Textarea
            label="SEO Description"
            name="seoDescription"
            defaultValue={post.seoDescription ?? ""}
            rows={2}
            className="min-h-[60px]"
          />
        </fieldset>

        <div className="flex gap-3">
          <Button type="submit">Save Post</Button>
          <Button type="submit" name="intent" value="delete" variant="outline" className="text-red-600">
            Delete Post
          </Button>
        </div>
      </Form>
    </div>
  );
}
