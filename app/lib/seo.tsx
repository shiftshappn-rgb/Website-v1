function getAppUrl(): string {
  if (typeof process !== "undefined" && process.env.APP_URL) {
    return process.env.APP_URL;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:5173";
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

export function organizationJsonLd() {
  const appUrl = getAppUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "shiftshappn",
    url: appUrl,
    logo: `${appUrl}/logo.png`,
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
    url: getCanonicalUrl(`/products/${product.slug}`),
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
