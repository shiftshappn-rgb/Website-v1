import type { Route } from "./+types/blog-index";
import { Link } from "react-router";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Blog — shiftshappn",
    description: "Tips, stories, and updates from the shiftshappn team.",
    path: "/blog",
  });
}

export async function loader({}: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { posts: [], cloudName: process.env.CLOUDINARY_CLOUD_NAME };
  }

  const db = tryDb();
  if (!db) {
    return { posts: [], cloudName: process.env.CLOUDINARY_CLOUD_NAME };
  }

  const posts = await db.blogPost.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      coverImage: true,
      author: true,
      publishedAt: true,
      tags: true,
    },
  });

  return { posts, cloudName: process.env.CLOUDINARY_CLOUD_NAME };
}

export default function BlogIndex({ loaderData }: Route.ComponentProps) {
  const { posts, cloudName } = loaderData;
  const cloud = cloudName ?? "demo";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <header className="mb-10 lg:mb-14 text-center">
        <h1 className="text-3xl lg:text-4xl font-serif text-navy">The shiftshappn journal</h1>
        <p className="mt-3 text-charcoal/70 max-w-xl mx-auto">
          Stories, tips, and insights for healthcare professionals
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-center text-charcoal/50 py-16">No posts yet. Check back soon.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <article key={post.id} className="group">
              <Link to={`/blog/${post.slug}`}>
                <div className="aspect-[16/10] bg-sand rounded-xl overflow-hidden mb-4">
                  {post.coverImage ? (
                    <img
                      src={
                        post.coverImage.startsWith("http")
                          ? post.coverImage
                          : `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_600/${post.coverImage}`
                      }
                      alt={post.title}
                      className="w-full h-full object-cover transition-opacity group-hover:opacity-90"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-sand" />
                  )}
                </div>
                <h2 className="text-lg font-serif text-navy group-hover:text-terracotta transition-colors">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="mt-2 text-sm text-charcoal/70 line-clamp-2">{post.excerpt}</p>
                )}
                <p className="mt-3 text-xs text-charcoal/50">
                  {post.publishedAt &&
                    new Date(post.publishedAt).toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  {post.author && ` · ${post.author}`}
                </p>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
