import type { HomepageBlockType } from "@prisma/client";
import { buildCatalogProducts } from "~/lib/product-catalog";

export type DemoHomepageBlock = {
  id: string;
  type: HomepageBlockType;
  order: number;
  content: Record<string, unknown>;
  isActive: boolean;
};

export type DemoProduct = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  variants: Array<{
    id: string;
    colorName: string;
    colorHex: string;
    size: string;
    priceOverride: number | null;
    inventoryQty: number;
    images: Array<{ publicId: string; altText: string; sortOrder: number }>;
  }>;
};

export const demoHomepageBlocks: DemoHomepageBlock[] = [
  {
    id: "demo-hero",
    type: "hero",
    order: 0,
    isActive: true,
    content: {
      badge: "NEW — SAGE COLLECTION",
      headline:
        "Scrubs that feel like they were made for your shift, not against it.",
      body: "Soft, stretch fabric with pockets that actually hold what you carry.",
      ctaLabel: "Shop the collection",
      ctaLink: "/collections/best-sellers",
    },
  },
  {
    id: "demo-marquee",
    type: "marquee",
    order: 1,
    isActive: true,
    content: {
      items: [
        "shiftshappn",
        "canadian made",
        "4-way stretch",
        "pockets that work",
        "built for the shift",
      ],
    },
  },
  {
    id: "demo-quick-shop",
    type: "quickShopRow",
    order: 2,
    isActive: true,
    content: {
      items: [
        { label: "Tops", link: "/shop/women", icon: "shirt" },
        { label: "Pants", link: "/shop/women", icon: "pants" },
        { label: "Sets", link: "/collections/best-sellers", icon: "layers" },
        { label: "Accessories", link: "/shop", icon: "bag" },
        { label: "Find my size", link: "/size-chart", icon: "ruler" },
      ],
    },
  },
  {
    id: "demo-category-duo",
    type: "categoryDuo",
    order: 3,
    isActive: true,
    content: {
      womenLabel: "Shop women",
      womenLink: "/shop/women",
      womenBgColor: "#8FA68E",
      menLabel: "Shop men",
      menLink: "/shop/men",
      menBgColor: "#5CA8D6",
    },
  },
  {
    id: "demo-product-grid",
    type: "productGrid",
    order: 4,
    isActive: true,
    content: {
      headline: "Best sellers",
      layout: "carousel",
      collectionSlug: "best-sellers",
      productSlugs: ["nova-top", "zephyr-top", "luna-pants", "eclipse-top", "aura-pants"],
    },
  },
  {
    id: "demo-size-finder",
    type: "sizeFinderStrip",
    order: 5,
    isActive: true,
    content: {
      text: "Not sure of your size? Take our 30-second fit finder.",
      ctaLabel: "Find my fit",
      ctaLink: "/size-chart",
    },
  },
  {
    id: "demo-bundle-banner",
    type: "bundleBanner",
    order: 6,
    isActive: true,
    content: {
      badge: "BEST VALUE",
      headline: "The shift bundle",
      body: "Full scrub set + tote. $53 off — limited stock.",
      ctaLabel: "Shop bundle",
      ctaLink: "/collections/bundles",
    },
  },
  {
    id: "demo-gift-card-banner",
    type: "giftCardBanner",
    order: 7,
    isActive: true,
    content: {
      badge: "GIFTING",
      headline: "Give the gift of a better shift",
      body: "Digital codes for new grads, night-shift friends, or your whole unit. Redeem on any order.",
      ctaLabel: "Shop gift cards",
      ctaLink: "/gift-cards",
      amounts: [50, 100, 150],
      previewAmount: 100,
    },
  },
  {
    id: "demo-fabric-callout",
    type: "fabricCallout",
    order: 8,
    isActive: true,
    content: {
      headline: "THE FABRIC",
      subheadline:
        "4-way stretch. Antimicrobial. Dry before your next patient.",
      features: [],
      specs: ["82% poly / 18% spandex", "Moisture-wicking"],
    },
  },
  {
    id: "demo-brand-story",
    type: "brandStory",
    order: 9,
    isActive: true,
    content: {
      badge: "OUR STORY",
      headline:
        "Designed by a nurse who got tired of scrubs that didn't work as hard as she did.",
      ctaLabel: "Read our story",
      ctaLink: "/about",
    },
  },
  {
    id: "demo-review-highlight",
    type: "reviewHighlight",
    order: 10,
    isActive: true,
    content: {
      reviews: [
        {
          quote:
            "The fit is just too good. All the pockets mean I never lose my pen, and it dries so fast even on a 16-hour shift.",
          author: "Camille B.",
          rating: 5,
          verified: true,
        },
        {
          quote:
            "Finally scrubs that feel like real clothes. The sage colour is perfect for long shifts.",
          author: "Jordan T.",
          rating: 5,
          verified: true,
        },
        {
          quote:
            "Canadian made and worth every penny. My whole unit is switching to shiftshappn.",
          author: "Priya M.",
          rating: 5,
          verified: true,
        },
      ],
    },
  },
  {
    id: "demo-value-props",
    type: "valuePropsRow",
    order: 11,
    isActive: true,
    content: {
      items: [
        { label: "Canadian made", icon: "map-pin" },
        { label: "Extra pockets", icon: "layers" },
        { label: "Quick-dry", icon: "droplets" },
        { label: "Pet hair-proof", icon: "shield" },
      ],
    },
  },
];

export const demoProducts: DemoProduct[] = buildCatalogProducts().map(
  (product, index) => ({
    id: `demo-${product.slug}`,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    basePrice: product.basePrice,
    compareAtPrice: null,
    variants: product.colors.map((color, colorIndex) => ({
      id: `demo-${product.slug}-${colorIndex}`,
      colorName: color.name,
      colorHex: color.hex,
      size: index % 2 === 0 ? "M" : "S",
      priceOverride: null,
      inventoryQty: 20,
      images: [],
    })),
  })
);
