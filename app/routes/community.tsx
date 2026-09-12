import { Form, useActionData } from "react-router";
import type { Route } from "./+types/community";
import { Button } from "~/components/ui/Button";
import { Input, Textarea } from "~/components/ui/Input";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";
import { getCustomer } from "~/lib/session.server";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Community — shiftshappn",
    description: "Shift stories from people who wear shiftshappn.",
    path: "/community",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const customer = await getCustomer(request);
  if (!isDatabaseAvailable()) {
    return { posts: [], defaultName: customer?.name ?? "" };
  }
  const db = tryDb();
  const posts = db
    ? await db.communityPost.findMany({
        where: { status: "approved" },
        orderBy: { createdAt: "desc" },
      })
    : [];
  return {
    defaultName: customer?.name ?? "",
    posts: posts.map((post) => ({
      id: post.id,
      authorName: post.authorName,
      title: post.title,
      body: post.body,
      createdAt: post.createdAt.toISOString(),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Community posts are unavailable right now." };
  }
  const db = tryDb();
  if (!db) {
    return { error: "Community posts are unavailable right now." };
  }

  const formData = await request.formData();
  if (String(formData.get("website") ?? "").trim()) {
    return { submitted: true };
  }

  const customer = await getCustomer(request);
  const authorName =
    String(formData.get("authorName") ?? "").trim() || customer?.name?.trim() || "";
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (authorName.length < 2 || title.length < 4 || body.length < 20) {
    return { error: "Add your name, a title, and at least 20 characters." };
  }

  await db.communityPost.create({
    data: { authorName, title, body, status: "pending" },
  });
  return { submitted: true };
}

export default function Community({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <h1 className="font-serif text-3xl text-navy lg:text-4xl">Community</h1>
      <p className="mt-3 text-charcoal/70">
        Stories from the floor — first shifts, long nights, and the kit that held up.
      </p>

      <div className="mt-10 space-y-6">
        {loaderData.posts.length === 0 ? (
          <p className="text-charcoal/60">No stories published yet. Be the first.</p>
        ) : (
          loaderData.posts.map((post) => (
            <article
              key={post.id}
              className="rounded-xl border border-charcoal/10 bg-white p-6"
            >
              <h2 className="font-serif text-xl text-navy">{post.title}</h2>
              <p className="mt-1 text-xs text-charcoal/50">
                {post.authorName} · {new Date(post.createdAt).toLocaleDateString()}
              </p>
              <p className="mt-3 whitespace-pre-line text-sm text-charcoal/80">{post.body}</p>
            </article>
          ))
        )}
      </div>

      <div className="mt-12 max-w-xl">
        <h2 className="mb-4 font-serif text-xl text-navy">Share a shift story</h2>
        {actionData?.submitted ? (
          <p className="rounded-xl border border-navy/15 bg-white p-6 text-sm text-navy">
            Thanks — we will review it before it goes live.
          </p>
        ) : (
          <Form method="post" className="space-y-4 rounded-xl border border-charcoal/10 bg-white p-6">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />
            <Input
              label="Name"
              name="authorName"
              required
              defaultValue={loaderData.defaultName}
            />
            <Input label="Title" name="title" required maxLength={120} />
            <Textarea label="Story" name="body" required minLength={20} rows={5} />
            {actionData?.error && (
              <p className="text-sm text-red-700">{actionData.error}</p>
            )}
            <Button type="submit">Submit story</Button>
          </Form>
        )}
      </div>
    </div>
  );
}
