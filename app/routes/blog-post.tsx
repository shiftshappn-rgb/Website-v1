import type { Route } from "./+types/blog-post";
import { Link, data } from "react-router";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { buildMeta, JsonLd, blogPostingJsonLd } from "~/lib/seo";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.post) {
    return [{ title: "Post not found — shiftshappn" }];
  }
  const { post } = loaderData;
  return buildMeta({
    title: post.seoTitle ?? `${post.title} — shiftshappn`,
    description: post.seoDescription ?? post.excerpt ?? post.title,
    image: post.coverImage ?? undefined,
    path: `/blog/${post.slug}`,
  });
}

export async function loader({ params }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    throw data("Post not found", { status: 404 });
  }

  const db = tryDb();
  if (!db) {
    throw data("Post not found", { status: 404 });
  }

  const post = await db.blogPost.findUnique({
    where: { slug: params.slug, status: "published" },
  });

  if (!post) {
    throw data("Post not found", { status: 404 });
  }

  return { post, cloudName: process.env.CLOUDINARY_CLOUD_NAME };
}

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post, cloudName } = loaderData;
  const cloud = cloudName ?? "demo";

  return (
    <>
      <JsonLd
        data={blogPostingJsonLd({
          title: post.title,
          excerpt: post.excerpt,
          slug: post.slug,
          author: post.author,
          publishedAt: post.publishedAt,
          coverImage: post.coverImage,
        })}
      />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <Link
          to="/blog"
          className="text-sm text-navy hover:text-terracotta transition-colors"
        >
          ← Back to blog
        </Link>

        <header className="mt-6 mb-8">
          <h1 className="text-3xl lg:text-4xl font-serif text-navy">{post.title}</h1>
          <p className="mt-4 text-sm text-charcoal/60">
            {post.publishedAt &&
              new Date(post.publishedAt).toLocaleDateString("en-CA", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            {post.author && ` · ${post.author}`}
          </p>
        </header>

        {post.coverImage && (
          <div className="aspect-[16/9] rounded-xl overflow-hidden mb-10 bg-sand">
            <img
              src={
                post.coverImage.startsWith("http")
                  ? post.coverImage
                  : `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_1200/${post.coverImage}`
              }
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div
          className="prose-brand"
          dangerouslySetInnerHTML={{ __html: post.bodyRichText }}
        />

        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full bg-sand text-xs text-charcoal/70"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </article>
    </>
  );
}
