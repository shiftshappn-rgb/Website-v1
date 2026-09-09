import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-blog-new";
import { Button } from "~/components/ui/Button";
import { Input, Select, Textarea } from "~/components/ui/Input";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { slugify } from "~/lib/utils";
import { requireAdmin } from "~/lib/session.server";
import type { BlogStatus } from "@prisma/client";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);
  return { dbAvailable: true as const };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
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

  const existing = await db.blogPost.findUnique({ where: { slug } });
  if (existing) {
    return { error: "A post with this slug already exists." };
  }

  const post = await db.blogPost.create({
    data: {
      title,
      slug,
      excerpt,
      bodyRichText,
      coverImage,
      author,
      status,
      publishedAt: status === "published" ? new Date() : null,
      seoTitle,
      seoDescription,
      tags,
    },
  });

  return redirect(`/admin/blog/${post.id}`);
}

export default function AdminBlogNew({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-serif text-navy">New Blog Post</h1>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <Form method="post" className="space-y-6 rounded-xl border border-charcoal/10 bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Title" name="title" required />
          <Input label="Slug" name="slug" placeholder="auto-generated" />
        </div>

        <Textarea label="Excerpt" name="excerpt" rows={2} className="min-h-[60px]" />
        <Textarea label="Body" name="bodyRichText" required rows={12} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Cover Image URL" name="coverImage" />
          <Input label="Author" name="author" />
        </div>

        <Select label="Status" name="status" defaultValue="draft">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </Select>

        <Input label="Tags (comma-separated)" name="tags" placeholder="scrubs, fashion, tips" />

        <fieldset className="space-y-4 rounded-lg border border-charcoal/10 p-4">
          <legend className="px-2 text-sm font-medium text-navy">SEO</legend>
          <Input label="SEO Title" name="seoTitle" />
          <Textarea label="SEO Description" name="seoDescription" rows={2} className="min-h-[60px]" />
        </fieldset>

        <Button type="submit">Create Post</Button>
      </Form>
    </div>
  );
}
