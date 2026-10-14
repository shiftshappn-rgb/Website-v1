import { Form, Link, useActionData } from "react-router";
import type { Route } from "./+types/community";
import { Button } from "~/components/ui/Button";
import { Input, Textarea } from "~/components/ui/Input";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";
import { getCustomer } from "~/lib/session.server";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Community — shiftshappn",
    description:
      "The people who take care of everyone else are the worst at being taken care of themselves. shiftshappn exists for them.",
    path: "/community",
  });
}

function isHttpUrl(value: string | null | undefined) {
  if (!value) return false;
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
  const customer = await getCustomer(request);
  const crew = customer
    ? { name: customer.name, points: customer.loyaltyPoints }
    : null;

  if (!isDatabaseAvailable()) {
    return { posts: [], defaultName: customer?.name ?? "", crew };
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
    crew,
    posts: posts.map((post) => ({
      id: post.id,
      authorName: post.authorName,
      role: post.role,
      workplace: post.workplace,
      title: post.title,
      body: post.body,
      image: isHttpUrl(post.image) ? post.image : null,
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
  const role = optionalText(formData.get("role"));
  const workplace = optionalText(formData.get("workplace"));
  const imageRaw = String(formData.get("image") ?? "").trim();
  if (imageRaw && !isHttpUrl(imageRaw)) {
    return { error: "Photo must be an http or https link." };
  }

  if (authorName.length < 2 || title.length < 4 || body.length < 20) {
    return { error: "Add your name, a title, and at least 20 characters." };
  }

  await db.communityPost.create({
    data: {
      authorName,
      role,
      workplace,
      title,
      body,
      image: imageRaw || null,
      status: "pending",
    },
  });
  return { submitted: true };
}

function storyCredit(post: {
  authorName: string;
  role: string | null;
  workplace: string | null;
}) {
  const detail = [post.role, post.workplace].filter(Boolean).join(", ");
  return detail ? `${post.authorName}, ${detail}` : post.authorName;
}

export default function Community({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const { crew } = loaderData;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-terracotta">
        Community
      </p>
      <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.15] text-navy lg:text-5xl">
        The people who take care of everyone else are the worst at being taken care of themselves.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-charcoal/80">shiftshappn exists for them.</p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-charcoal/10 bg-white p-6">
          <h2 className="font-serif text-xl text-navy">Nursing and health students</h2>
          <p className="mt-3 text-sm leading-relaxed text-charcoal/75">
            Anxious, and trying to look like you belong before you feel like you do. What you
            need is identity: I&apos;m becoming one of them.
          </p>
        </section>
        <section className="rounded-2xl border border-charcoal/10 bg-white p-6">
          <h2 className="font-serif text-xl text-navy">Working nurses</h2>
          <p className="mt-3 text-sm leading-relaxed text-charcoal/75">
            Burned out and used to being invisible. What you need is recognition: someone sees
            what this costs me.
          </p>
        </section>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-charcoal/70">
        Pinning day is the bridge. That is where a student becomes a professional, and where we
        want to be in the room.
      </p>

      <section className="mt-12 rounded-2xl bg-navy px-6 py-8 text-white sm:px-8">
        <h2 className="font-serif text-2xl">Shift Crew</h2>
        {crew ? (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-4xl font-medium tabular-nums">{crew.points} pts</p>
              <p className="mt-2 max-w-md text-sm text-white/75">
                {crew.name ? `${crew.name}, you earn` : "You earn"} 1 point for every dollar on a
                paid order. 100 points is a $5 store credit.
              </p>
            </div>
            <Link
              to="/account/rewards"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-navy hover:bg-sand"
            >
              View rewards
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm text-white/75">
              Sign in to see your points and what 100 points is worth.
            </p>
            <Link
              to="/auth/login?redirectTo=/community"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-navy hover:bg-sand"
            >
              Sign in
            </Link>
          </div>
        )}
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-3xl text-navy">Member stories</h2>
        <div className="mt-8 space-y-6">
          {loaderData.posts.length === 0 ? (
            <p className="text-charcoal/60">No stories published yet. Be the first.</p>
          ) : (
            loaderData.posts.map((post) => (
              <article
                key={post.id}
                className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white"
              >
                {post.image && (
                  <img
                    src={post.image}
                    alt=""
                    className="aspect-[16/9] w-full object-cover"
                  />
                )}
                <div className="p-6 sm:p-8">
                  <h3 className="font-serif text-2xl leading-snug text-navy">
                    &ldquo;{post.title}&rdquo;
                  </h3>
                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-charcoal/80">
                    {post.body}
                  </p>
                  <p className="mt-5 text-sm font-medium text-navy">{storyCredit(post)}</p>
                  <p className="mt-1 text-xs text-charcoal/50">
                    {new Date(post.createdAt).toLocaleDateString("en-CA")}
                  </p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <div className="mt-16 max-w-xl">
        <h2 className="mb-4 font-serif text-2xl text-navy">Share a shift story</h2>
        {actionData?.submitted ? (
          <p className="rounded-2xl border border-navy/15 bg-white p-6 text-sm text-navy">
            Thanks. We will review it before it goes live.
          </p>
        ) : (
          <Form method="post" className="space-y-4 rounded-2xl border border-charcoal/10 bg-white p-6">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />
            <Input
              label="Name"
              name="authorName"
              required
              defaultValue={loaderData.defaultName}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Role (optional)" name="role" maxLength={80} placeholder="RN" />
              <Input
                label="Workplace (optional)"
                name="workplace"
                maxLength={80}
                placeholder="IWK"
              />
            </div>
            <Input
              label="Photo link (optional)"
              name="image"
              type="url"
              placeholder="https://"
            />
            <Input label="Title" name="title" required maxLength={120} />
            <Textarea label="Story" name="body" required minLength={20} rows={5} />
            {actionData?.error && <p className="text-sm text-red-700">{actionData.error}</p>}
            <Button type="submit">Submit story</Button>
          </Form>
        )}
      </div>
    </div>
  );
}
