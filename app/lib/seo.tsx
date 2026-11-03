function getAppUrl(override?: string): string {
  const raw =
    override ||
    (typeof process !== "undefined" ? process.env.APP_URL : undefined) ||
    // Vite-exposed fallback so client and server share one baked value.
    (typeof import.meta !== "undefined"
      ? (import.meta.env.VITE_APP_URL as string | undefined)
      : undefined) ||
    "http://localhost:5173";
  return String(raw).replace(/\/$/, "");
}

export function getCanonicalUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppUrl()}${cleanPath.split("?")[0]}`;
}

export function buildMeta({
  title,
  description,
  image,
  path = "/",
}: {
  title: string;
  description: string;
  image?: string;
  path?: string;
}) {
  const canonical = getCanonicalUrl(path);
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical },
    ...(image ? [{ property: "og:image", content: image }] : []),
    { tagName: "link", rel: "canonical", href: canonical },
  ];
}

export function organizationJsonLd(appUrlOverride?: string) {
  const appUrl = getAppUrl(appUrlOverride);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "shiftshappn",
    url: appUrl,
    logo: `${appUrl}/images/logo.png`,
    description:
      "Premium Canadian medical scrubs designed for healthcare professionals.",
    address: {
      "@type": "PostalAddress",
      addressCountry: "CA",
    },
  };
}

export function productJsonLd(product: {
  name: string;
  description: string;
  slug: string;
  path?: string;
  price: number;
  currency?: string;
  inStock: boolean;
  image?: string;
  rating?: number;
  reviewCount?: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    url: getCanonicalUrl(product.path ?? `/products/${product.slug}`),
    image: product.image,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency ?? "CAD",
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    ...(product.rating && product.reviewCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };
}

export function blogPostingJsonLd(post: {
  title: string;
  excerpt?: string | null;
  slug: string;
  author?: string | null;
  publishedAt?: Date | null;
  coverImage?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    url: getCanonicalUrl(`/blog/${post.slug}`),
    author: post.author
      ? { "@type": "Person", name: post.author }
      : undefined,
    datePublished: post.publishedAt?.toISOString(),
    image: post.coverImage,
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getCanonicalUrl(item.path),
    })),
  };
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // APP_URL (SSR) can differ from the browser origin; crawlers use the SSR HTML.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
