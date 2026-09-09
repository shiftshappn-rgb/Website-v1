import type { Route } from "./+types/sitemap";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { getCanonicalUrl } from "~/lib/seo";

const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

function urlEntry(loc: string, lastmod?: string, changefreq?: string, priority?: string) {
  return `<url>
  <loc>${loc}</loc>${lastmod ? `\n  <lastmod>${lastmod}</lastmod>` : ""}${changefreq ? `\n  <changefreq>${changefreq}</changefreq>` : ""}${priority ? `\n  <priority>${priority}</priority>` : ""}
</url>`;
}

export async function loader({}: Route.LoaderArgs) {
  const staticPages = [
    "/",
    "/shop",
    "/shop/women",
    "/shop/men",
    "/shop/colour",
    "/shop/fabric",
    "/blog",
    "/about",
    "/faq",
    "/contact",
    "/size-chart",
  ];

  let dynamicUrls: string[] = [];

  if (isDatabaseAvailable()) {
    const db = tryDb();
    if (db) {
      const [products, collections, posts] = await Promise.all([
        db.product.findMany({
          where: { status: "active" },
          select: { slug: true, updatedAt: true },
        }),
        db.collection.findMany({ select: { slug: true, updatedAt: true } }),
        db.blogPost.findMany({
          where: { status: "published" },
          select: { slug: true, updatedAt: true },
        }),
      ]);

      dynamicUrls = [
        ...products.map((p) =>
          urlEntry(getCanonicalUrl(`/products/${p.slug}`), p.updatedAt.toISOString().split("T")[0], "weekly", "0.8")
        ),
        ...collections.map((c) =>
          urlEntry(getCanonicalUrl(`/collections/${c.slug}`), c.updatedAt.toISOString().split("T")[0], "weekly", "0.7")
        ),
        ...posts.map((p) =>
          urlEntry(getCanonicalUrl(`/blog/${p.slug}`), p.updatedAt.toISOString().split("T")[0], "monthly", "0.6")
        ),
      ];
    }
  }

  const staticUrls = staticPages.map((path) =>
    urlEntry(getCanonicalUrl(path), undefined, "weekly", path === "/" ? "1.0" : "0.7")
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...dynamicUrls].join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
