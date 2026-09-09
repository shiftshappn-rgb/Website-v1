import { PrismaClient, ProductStatus, HomepageBlockType, BlogStatus } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";
import {
  buildCatalogProducts,
  catalogSku,
  CATALOG_COLORS,
  CATALOG_SIZES,
} from "../app/lib/product-catalog";
import { slugify } from "../app/lib/utils";

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding");
}

const adapter = new PrismaNeon({ connectionString });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const adminPassword = await bcrypt.hash("admin123", 12);
  await db.adminUser.upsert({
    where: { email: "admin@shiftshappn.com" },
    update: {},
    create: {
      email: "admin@shiftshappn.com",
      passwordHash: adminPassword,
      role: "superadmin",
    },
  });

  const womenCategory = await db.category.upsert({
    where: { slug: "women" },
    update: {},
    create: { name: "Women", slug: "women", sortOrder: 0 },
  });

  const menCategory = await db.category.upsert({
    where: { slug: "men" },
    update: {},
    create: { name: "Men", slug: "men", sortOrder: 1 },
  });

  const womenTops = await db.category.upsert({
    where: { slug: "women-tops" },
    update: {},
    create: {
      name: "Scrub Tops",
      slug: "women-tops",
      parentCategoryId: womenCategory.id,
      sortOrder: 0,
    },
  });

  const menTops = await db.category.upsert({
    where: { slug: "men-tops" },
    update: {},
    create: {
      name: "Scrub Tops",
      slug: "men-tops",
      parentCategoryId: menCategory.id,
      sortOrder: 0,
    },
  });

  const womenPants = await db.category.upsert({
    where: { slug: "women-pants" },
    update: {},
    create: {
      name: "Scrub Pants",
      slug: "women-pants",
      parentCategoryId: womenCategory.id,
      sortOrder: 1,
    },
  });

  const menPants = await db.category.upsert({
    where: { slug: "men-pants" },
    update: {},
    create: {
      name: "Scrub Pants",
      slug: "men-pants",
      parentCategoryId: menCategory.id,
      sortOrder: 1,
    },
  });

  const fabricType = await db.fabricType.upsert({
    where: { slug: "4-way-stretch" },
    update: {},
    create: {
      name: "4-Way Stretch",
      slug: "4-way-stretch",
      description: "Soft, stretch fabric with antimicrobial treatment",
    },
  });

  for (const [index, [name, hex]] of Object.entries(CATALOG_COLORS).entries()) {
    await db.catalogColor.upsert({
      where: { slug: slugify(name) },
      update: { name, hex, sortOrder: index },
      create: { name, slug: slugify(name), hex, sortOrder: index },
    });
  }

  const bestSellers = await db.collection.upsert({
    where: { slug: "best-sellers" },
    update: {},
    create: {
      name: "Best Sellers",
      slug: "best-sellers",
      description: "Our most-loved scrubs",
    },
  });

  const catalogProducts = buildCatalogProducts();

  for (const item of catalogProducts) {
    const categoryId =
      item.audience === "women"
        ? item.piece === "top"
          ? womenTops.id
          : womenPants.id
        : item.piece === "top"
          ? menTops.id
          : menPants.id;

    const product = await db.product.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        description: item.description,
        shortDescription: item.shortDescription,
        basePrice: item.basePrice,
        categoryId,
        fabricTypeId: fabricType.id,
        status: ProductStatus.active,
        seoTitle: `${item.name} | shiftshappn`,
        seoDescription: item.shortDescription,
      },
      create: {
        slug: item.slug,
        name: item.name,
        description: item.description,
        shortDescription: item.shortDescription,
        basePrice: item.basePrice,
        compareAtPrice: null,
        categoryId,
        fabricTypeId: fabricType.id,
        status: ProductStatus.active,
        seoTitle: `${item.name} | shiftshappn`,
        seoDescription: item.shortDescription,
      },
    });

    const variants = item.colors.flatMap((color) =>
      CATALOG_SIZES.map((size) => ({
        productId: product.id,
        colorName: color.name,
        colorHex: color.hex,
        size,
        sku: catalogSku(item.styleId, item.piece, color.name, size),
        inventoryQty: 25,
        images: [],
      }))
    );

    await db.productVariant.createMany({
      data: variants,
      skipDuplicates: true,
    });

    await db.productCollection.upsert({
      where: {
        productId_collectionId: {
          productId: product.id,
          collectionId: bestSellers.id,
        },
      },
      update: {},
      create: {
        productId: product.id,
        collectionId: bestSellers.id,
      },
    });
  }

  const retiredSlugs = [
    "one-pocket-scrub-top",
    "jogger-scrub-pants",
    "mandarin-collar-top",
  ];
  await db.review.deleteMany({
    where: { product: { slug: { in: retiredSlugs } } },
  });
  await db.productCollection.deleteMany({
    where: { product: { slug: { in: retiredSlugs } } },
  });
  await db.product.deleteMany({
    where: { slug: { in: retiredSlugs } },
  });

  const homepageBlocks = [
    {
      type: HomepageBlockType.hero,
      order: 0,
      content: {
        badge: "NEW — SAGE COLLECTION",
        headline: "Scrubs that feel like they were made for your shift, not against it.",
        body: "Soft, stretch fabric with pockets that actually hold what you carry.",
        ctaLabel: "Shop the collection",
        ctaLink: "/collections/best-sellers",
      },
    },
    {
      type: HomepageBlockType.marquee,
      order: 1,
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
      type: HomepageBlockType.quickShopRow,
      order: 2,
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
      type: HomepageBlockType.categoryDuo,
      order: 3,
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
      type: HomepageBlockType.productGrid,
      order: 4,
      content: {
        headline: "Best sellers",
        collectionSlug: "best-sellers",
      },
    },
    {
      type: HomepageBlockType.sizeFinderStrip,
      order: 5,
      content: {
        text: "Not sure of your size? Take our 30-second fit finder.",
        ctaLabel: "Find my fit",
        ctaLink: "/size-chart",
      },
    },
    {
      type: HomepageBlockType.bundleBanner,
      order: 6,
      content: {
        badge: "BEST VALUE",
        headline: "The shift bundle",
        body: "Full scrub set + tote. $53 off — limited stock.",
        ctaLabel: "Shop bundle",
        ctaLink: "/collections/bundles",
      },
    },
    {
      type: HomepageBlockType.fabricCallout,
      order: 7,
      content: {
        headline: "THE FABRIC",
        subheadline:
          "4-way stretch. Antimicrobial. Dry before your next patient.",
        features: [],
        specs: ["82% poly / 18% spandex", "Moisture-wicking"],
      },
    },
    {
      type: HomepageBlockType.brandStory,
      order: 8,
      content: {
        badge: "OUR STORY",
        headline:
          "Designed by a nurse who got tired of scrubs that didn't work as hard as she did.",
        ctaLabel: "Read our story",
        ctaLink: "/about",
      },
    },
    {
      type: HomepageBlockType.reviewHighlight,
      order: 9,
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
      type: HomepageBlockType.valuePropsRow,
      order: 10,
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

  const existingBlocks = await db.homepageBlock.count();
  if (existingBlocks === 0) {
    for (const block of homepageBlocks) {
      await db.homepageBlock.create({ data: block });
    }
  } else {
    const hasMarquee = await db.homepageBlock.findFirst({
      where: { type: HomepageBlockType.marquee },
    });
    if (!hasMarquee) {
      await db.homepageBlock.create({
        data: homepageBlocks.find((b) => b.type === HomepageBlockType.marquee)!,
      });
    }
  }

  await db.review.createMany({
    skipDuplicates: true,
    data: [
      {
        productId: (await db.product.findFirst({ where: { slug: "nova-top" } }))!.id,
        customerName: "Camille B.",
        rating: 5,
        title: "Perfect fit",
        body: "The fit is just too good. All the pockets mean I never lose my pen.",
        verifiedPurchase: true,
        status: "approved",
      },
    ],
  });

  await db.blogPost.upsert({
    where: { slug: "why-we-started-shiftshappn" },
    update: {},
    create: {
      slug: "why-we-started-shiftshappn",
      title: "Why we started shiftshappn",
      excerpt: "A nurse's frustration with scrubs that didn't work as hard as she did.",
      bodyRichText: "<p>It started on a 16-hour shift...</p>",
      author: "Founder",
      status: BlogStatus.published,
      publishedAt: new Date(),
      tags: ["story", "founder"],
    },
  });

  const policies = [
    { slug: "shipping", title: "Shipping Policy", content: "<p>Free shipping on orders over $100 CAD within Canada.</p>" },
    { slug: "returns", title: "Returns & Exchanges", content: "<p>Free 14-day returns on unworn items with tags attached.</p>" },
    { slug: "privacy", title: "Privacy Policy", content: "<p>We respect your privacy and protect your personal information.</p>" },
    { slug: "terms", title: "Terms of Service", content: "<p>By using shiftshappn.com you agree to these terms.</p>" },
  ];

  for (const policy of policies) {
    await db.policyPage.upsert({
      where: { slug: policy.slug },
      update: {},
      create: policy,
    });
  }

  await db.siteSetting.upsert({
    where: { key: "low_stock_threshold" },
    update: {},
    create: { key: "low_stock_threshold", value: 5 },
  });

  console.log("Seed complete!");
  console.log("Admin login: admin@shiftshappn.com / admin123");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
