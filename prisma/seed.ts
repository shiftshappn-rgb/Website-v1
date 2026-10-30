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
  CATALOG_STYLES,
} from "../app/lib/product-catalog";
import { STORE_POLICIES } from "../app/lib/store-policies";
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

  await db.category.upsert({
    where: { slug: "accessories" },
    update: { name: "Accessories" },
    create: { name: "Accessories", slug: "accessories", sortOrder: 2 },
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
  const productIds = new Map<string, string>();

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
        status: ProductStatus.archived,
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
        status: ProductStatus.archived,
        seoTitle: `${item.name} | shiftshappn`,
        seoDescription: item.shortDescription,
      },
    });
    productIds.set(item.slug, product.id);

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

  for (const style of CATALOG_STYLES) {
    const topId = productIds.get(`${style.slug}-top`);
    const pantsId = productIds.get(`${style.slug}-pants`);
    if (!topId || !pantsId) continue;

    const bundle = await db.bundle.upsert({
      where: { slug: style.slug },
      update: {
        name: style.name,
        description: style.features.join(" • "),
      },
      create: {
        slug: style.slug,
        name: style.name,
        description: style.features.join(" • "),
        discountType: "fixed",
        discountValue: 0,
      },
    });

    await db.bundleProduct.upsert({
      where: { bundleId_productId: { bundleId: bundle.id, productId: topId } },
      update: { role: "top", sortOrder: 0 },
      create: { bundleId: bundle.id, productId: topId, role: "top", sortOrder: 0 },
    });
    await db.bundleProduct.upsert({
      where: { bundleId_productId: { bundleId: bundle.id, productId: pantsId } },
      update: { role: "pants", sortOrder: 1 },
      create: { bundleId: bundle.id, productId: pantsId, role: "pants", sortOrder: 1 },
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
        ctaLink: "/shop",
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
          { label: "Sets", link: "/shop", icon: "layers" },
          { label: "Accessories", link: "/shop", icon: "bag" },
          { label: "Find my size", link: "/size-chart", icon: "ruler" },
        ],
      },
    },
    {
      type: HomepageBlockType.categoryDuo,
      order: 3,
      content: {
        headline: "Shop the fit",
        body: "Scrubs shaped by real shifts — soft stretch, serious pockets, and a fabric that keeps up when the day runs long.",
        womenLabel: "Shop women",
        womenLink: "/shop/women",
        womenSubline: "Built for her longest days.",
        womenImagePublicId: "/images/shop-women.jpg",
        womenBgColor: "#6B2D3C",
        menLabel: "Shop men",
        menLink: "/shop/men",
        menSubline: "Clean lines. Full range of motion.",
        menImagePublicId: "/images/shop-men.jpg",
        menBgColor: "#2B5A8A",
        featureHeadline: "Meet ShiftKnit",
        featureBody:
          "Our signature fabric: 4-way stretch, antimicrobial, and moisture-wicking — dry before your next patient.",
        featureCtaLabel: "Explore fabric",
        featureCtaLink: "/shiftknit",
      },
    },
    {
      type: HomepageBlockType.productGrid,
      order: 4,
      content: {
        headline: "Best sellers",
        layout: "carousel",
        collectionSlug: "best-sellers",
        productSlugs: ["nova", "zephyr", "luna", "eclipse", "aura"],
      },
    },
    {
      type: HomepageBlockType.packShowcase,
      order: 5,
      content: {
        headline: "Bundles",
        body: "A scrub set plus the extras that round out the shift.",
        packSlugs: [],
        ctaLabel: "Shop bundles",
        ctaLink: "/shop/bundles",
      },
    },
    {
      type: HomepageBlockType.sizeFinderStrip,
      order: 6,
      content: {
        text: "Not sure of your size? Take our 30-second fit finder.",
        ctaLabel: "Find my fit",
        ctaLink: "/size-chart",
      },
    },
    {
      type: HomepageBlockType.bundleBanner,
      order: 7,
      content: {
        badge: "BEST VALUE",
        headline: "The shift set",
        body: "One colour. Choose the top size and the pants size that fit you.",
        ctaLabel: "Shop sets",
        ctaLink: "/shop",
      },
    },
    {
      type: HomepageBlockType.giftCardBanner,
      order: 8,
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
      type: HomepageBlockType.fabricCallout,
      order: 9,
      content: {
        headline: "THE FABRIC",
        subheadline:
          "4-way stretch. Antimicrobial. Dry before your next patient.",
        features: [],
        specs: ["82% poly / 18% spandex", "Moisture-wicking"],
        imagePublicId: "/images/fabric-4way-stretch.jpg",
      },
    },
    {
      type: HomepageBlockType.brandStory,
      order: 10,
      content: {
        badge: "OUR STORY",
        headline:
          "Designed by a nurse who got tired of scrubs that didn't work as hard as she did.",
        ctaLabel: "Read our story",
        ctaLink: "/about",
        imagePublicId: "/images/our-story-fabric.png",
      },
    },
    {
      type: HomepageBlockType.reviewHighlight,
      order: 11,
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
      order: 12,
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

    const hasGiftCardBanner = await db.homepageBlock.findFirst({
      where: { type: HomepageBlockType.giftCardBanner },
    });
    if (!hasGiftCardBanner) {
      await db.homepageBlock.create({
        data: homepageBlocks.find((b) => b.type === HomepageBlockType.giftCardBanner)!,
      });
    }

    const hasPackShowcase = await db.homepageBlock.findFirst({
      where: { type: HomepageBlockType.packShowcase },
    });
    if (!hasPackShowcase) {
      const productGrid = await db.homepageBlock.findFirst({
        where: { type: HomepageBlockType.productGrid },
        orderBy: { order: "asc" },
      });
      const packShowcase = homepageBlocks.find(
        (block) => block.type === HomepageBlockType.packShowcase
      )!;
      await db.homepageBlock.create({
        data: {
          ...packShowcase,
          order: (productGrid?.order ?? 4) + 1,
          isActive: true,
        },
      });
    }
  }

  const setSlugs = ["nova", "zephyr", "luna", "eclipse", "aura"];
  const grids = await db.homepageBlock.findMany({
    where: { type: HomepageBlockType.productGrid },
  });
  for (const block of grids) {
    const content = (block.content ?? {}) as Record<string, unknown>;
    await db.homepageBlock.update({
      where: { id: block.id },
      data: {
        content: {
          ...content,
          productSlugs: setSlugs,
        },
      },
    });
  }

  const banners = await db.homepageBlock.findMany({
    where: { type: HomepageBlockType.bundleBanner },
  });
  for (const block of banners) {
    const content = (block.content ?? {}) as Record<string, unknown>;
    await db.homepageBlock.update({
      where: { id: block.id },
      data: {
        content: {
          ...content,
          headline: "The shift set",
          body: "One colour. Choose the top size and the pants size that fit you.",
          ctaLabel: "Shop sets",
          ctaLink: "/shop",
        },
      },
    });
  }

  const heroes = await db.homepageBlock.findMany({
    where: { type: HomepageBlockType.hero },
  });
  for (const block of heroes) {
    const content = (block.content ?? {}) as Record<string, unknown>;
    if (content.ctaLink === "/collections/best-sellers") {
      await db.homepageBlock.update({
        where: { id: block.id },
        data: { content: { ...content, ctaLink: "/shop" } },
      });
    }
  }

  const quickShops = await db.homepageBlock.findMany({
    where: { type: HomepageBlockType.quickShopRow },
  });
  for (const block of quickShops) {
    const content = (block.content ?? {}) as { items?: Array<{ label?: string; link?: string; icon?: string }> };
    if (!Array.isArray(content.items)) continue;
    const items = content.items.map((item) =>
      item.link === "/collections/best-sellers" || item.link === "/collections/bundles"
        ? { ...item, link: "/shop" }
        : item
    );
    await db.homepageBlock.update({
      where: { id: block.id },
      data: { content: { ...content, items } },
    });
  }

  const fabricCallouts = await db.homepageBlock.findMany({
    where: { type: HomepageBlockType.fabricCallout },
  });
  for (const block of fabricCallouts) {
    const content = (block.content ?? {}) as Record<string, unknown>;
    await db.homepageBlock.update({
      where: { id: block.id },
      data: {
        content: {
          ...content,
          imagePublicId: "/images/fabric-4way-stretch.jpg",
        },
      },
    });
  }

  const brandStories = await db.homepageBlock.findMany({
    where: { type: HomepageBlockType.brandStory },
  });
  for (const block of brandStories) {
    const content = (block.content ?? {}) as Record<string, unknown>;
    await db.homepageBlock.update({
      where: { id: block.id },
      data: {
        content: {
          ...content,
          imagePublicId: "/images/our-story-fabric.png",
        },
      },
    });
  }

  const novaTop = await db.product.findFirst({ where: { slug: "nova-top" } });
  const zephyrTop = await db.product.findFirst({ where: { slug: "zephyr-top" } });

  if (novaTop || zephyrTop) {
    await db.product.updateMany({
      where: { slug: { in: ["nova-top", "zephyr-top", "nova-pants", "zephyr-pants"] } },
      data: { status: ProductStatus.active },
    });
  }

  if (novaTop) {
    await db.review.deleteMany({ where: { productId: novaTop.id } });
    await db.review.createMany({
      data: [
        {
          productId: novaTop.id,
          customerName: "Camille B.",
          rating: 5,
          title: "Perfect fit",
          body: "The fit is just too good. All the pockets mean I never lose my pen, and it dries so fast even on a 16-hour shift.",
          verifiedPurchase: true,
          status: "approved",
          sizePurchased: "S",
          height: "160–165 cm",
          lengthPurchased: "Straight",
          weight: "130 lb",
          occupation: "RN",
          fit: "True to size",
          createdAt: new Date("2026-09-12"),
        },
        {
          productId: novaTop.id,
          customerName: "Jordan T.",
          rating: 5,
          title: "Finally scrubs that feel like clothes",
          body: "Soft from the first wash and the tapered fit still looks sharp at the end of a night shift. Ordering a second colour.",
          verifiedPurchase: true,
          status: "approved",
          sizePurchased: "M",
          height: "175–180 cm",
          lengthPurchased: "Tall",
          weight: "165 lb",
          occupation: "Paramedic",
          fit: "True to size",
          createdAt: new Date("2026-10-02"),
        },
      ],
    });
  }

  if (zephyrTop) {
    await db.review.deleteMany({ where: { productId: zephyrTop.id } });
    await db.review.createMany({
      data: [
        {
          productId: zephyrTop.id,
          customerName: "Nuttarika I.",
          rating: 5,
          title: "So beautiful and so comfy",
          body: "I've never worn scrubs before so nothing to compare to, but these feel soft, move with me, and the TRI-BAY panels keep everything where it should be.",
          verifiedPurchase: true,
          status: "approved",
          sizePurchased: "XXS",
          height: "170–175 cm",
          lengthPurchased: "Straight",
          weight: "145 lb",
          occupation: "Physician",
          fit: "Slightly big",
          createdAt: new Date("2026-10-29"),
        },
        {
          productId: zephyrTop.id,
          customerName: "Jennifer L.",
          rating: 4,
          title: "Great for long days",
          body: "Breathable enough for a busy floor and the high-rise waist stays put when I bend. I sized up one for a looser feel.",
          verifiedPurchase: true,
          status: "approved",
          sizePurchased: "S",
          height: "155–160 cm",
          lengthPurchased: "Jogger",
          weight: "120 lb",
          occupation: "RN",
          fit: "True to size",
          createdAt: new Date("2026-10-18"),
        },
        {
          productId: zephyrTop.id,
          customerName: "Sam R.",
          rating: 5,
          title: "Pockets that actually work",
          body: "Mobile-ready pockets held my phone and shears without sagging. Fabric still looks crisp after a week of washes.",
          verifiedPurchase: false,
          status: "approved",
          sizePurchased: "L",
          height: "180–185 cm",
          lengthPurchased: "Tall",
          weight: "190 lb",
          occupation: "Respiratory therapist",
          fit: "True to size",
          createdAt: new Date("2026-10-05"),
        },
      ],
    });
  }

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

  for (const policy of STORE_POLICIES) {
    await db.policyPage.upsert({
      where: { slug: policy.slug },
      update: { title: policy.title, content: policy.content },
      create: policy,
    });
  }

  await db.policyPage.upsert({
    where: { slug: "terms" },
    update: {},
    create: {
      slug: "terms",
      title: "Terms of Service",
      content: "<p>By using shiftshappn.com you agree to these terms.</p>",
    },
  });

  await db.siteSetting.upsert({
    where: { key: "low_stock_threshold" },
    update: {},
    create: { key: "low_stock_threshold", value: 5 },
  });

  await db.siteSetting.upsert({
    where: { key: "giftCardSellEnabled" },
    update: {},
    create: { key: "giftCardSellEnabled", value: { enabled: true } },
  });
  await db.siteSetting.upsert({
    where: { key: "giftCardDenominations" },
    update: {},
    create: {
      key: "giftCardDenominations",
      value: { values: [50, 75, 100, 150, 200, 250] },
    },
  });
  await db.siteSetting.upsert({
    where: { key: "giftCardIntroCopy" },
    update: {},
    create: {
      key: "giftCardIntroCopy",
      value: {
        text: "Give the gift of choice. Digital codes are emailed after checkout and can be redeemed on any order.",
      },
    },
  });

  await db.siteSetting.upsert({
    where: { key: "shippingRates" },
    update: {},
    create: {
      key: "shippingRates",
      value: { standard: 9.95, express: 15.0, freeThreshold: 100 },
    },
  });

  const hospitals = [
    {
      name: "Halifax Infirmary - Abbie J Lane Building",
      line1: "1796 Summer Street",
      line2: "Abbie J Lane Building",
      postalCode: "B3H 3A7",
    },
    {
      name: "Halifax Infirmary - Veterans Memorial Building",
      line1: "1796 Summer Street",
      line2: "Veterans Memorial Building",
      postalCode: "B3H 3A7",
    },
    {
      name: "Nova Scotia Rehabilitation Centre",
      line1: "1341 Summer Street",
      line2: "",
      postalCode: "B3H 4K4",
    },
    {
      name: "Victoria General - Dickson Building",
      line1: "278 Pleasant Street",
      line2: "Dickson Building",
      postalCode: "B3H 3A7",
    },
    {
      name: "Victoria General - Mackenzie Building",
      line1: "278 Pleasant Street",
      line2: "Mackenzie Building",
      postalCode: "B3H 3A7",
    },
    {
      name: "Victoria General - Centennial Building",
      line1: "278 Pleasant Street",
      line2: "Centennial Building",
      postalCode: "B3H 3A7",
    },
    {
      name: "IWK Emergency",
      line1: "5850 University Avenue",
      line2: "Emergency Department",
      postalCode: "B3K 6R8",
    },
    {
      name: "IWK Health Centre",
      line1: "5850 University Avenue",
      line2: "",
      postalCode: "B3K 6R8",
    },
    {
      name: "Dalhousie - Charles Tupper Building",
      line1: "5850 College Street",
      line2: "Charles Tupper Medical Building",
      postalCode: "B3H 4R2",
    },
    {
      name: "QEII Health Sciences Centre - Halifax Infirmary",
      line1: "1796 Summer Street",
      line2: "Halifax Infirmary",
      postalCode: "B3H 3A7",
    },
  ];

  const defaultTimeSlots = [
    { dayOfWeek: 1, label: "Morning", startTime: "08:00", endTime: "12:00", maxOrders: 10, isActive: true },
    { dayOfWeek: 1, label: "Afternoon", startTime: "12:00", endTime: "16:00", maxOrders: 10, isActive: true },
    { dayOfWeek: 1, label: "Evening", startTime: "16:00", endTime: "20:00", maxOrders: 5, isActive: true },
    { dayOfWeek: 2, label: "Morning", startTime: "08:00", endTime: "12:00", maxOrders: 10, isActive: true },
    { dayOfWeek: 2, label: "Afternoon", startTime: "12:00", endTime: "16:00", maxOrders: 10, isActive: true },
    { dayOfWeek: 2, label: "Evening", startTime: "16:00", endTime: "20:00", maxOrders: 5, isActive: true },
    { dayOfWeek: 3, label: "Morning", startTime: "08:00", endTime: "12:00", maxOrders: 10, isActive: true },
    { dayOfWeek: 3, label: "Afternoon", startTime: "12:00", endTime: "16:00", maxOrders: 10, isActive: true },
    { dayOfWeek: 3, label: "Evening", startTime: "16:00", endTime: "20:00", maxOrders: 5, isActive: true },
    { dayOfWeek: 4, label: "Morning", startTime: "08:00", endTime: "12:00", maxOrders: 10, isActive: true },
    { dayOfWeek: 4, label: "Afternoon", startTime: "12:00", endTime: "16:00", maxOrders: 10, isActive: true },
    { dayOfWeek: 4, label: "Evening", startTime: "16:00", endTime: "20:00", maxOrders: 5, isActive: true },
    { dayOfWeek: 5, label: "Morning", startTime: "08:00", endTime: "12:00", maxOrders: 10, isActive: true },
    { dayOfWeek: 5, label: "Afternoon", startTime: "12:00", endTime: "16:00", maxOrders: 10, isActive: true },
    { dayOfWeek: 5, label: "Evening", startTime: "16:00", endTime: "20:00", maxOrders: 5, isActive: true },
  ];

  for (let i = 0; i < hospitals.length; i++) {
    const hospital = hospitals[i];
    await db.deliveryLocation.upsert({
      where: { name: hospital.name },
      update: {},
      create: {
        name: hospital.name,
        type: "hospital",
        line1: hospital.line1,
        line2: hospital.line2 || null,
        city: "Halifax",
        province: "NS",
        postalCode: hospital.postalCode,
        country: "CA",
        freeDelivery: true,
        isActive: true,
        sortOrder: i,
        timeSlots: {
          create: defaultTimeSlots.map((slot) => ({
            dayOfWeek: slot.dayOfWeek,
            label: slot.label,
            startTime: slot.startTime,
            endTime: slot.endTime,
            maxOrders: slot.maxOrders,
            isActive: slot.isActive,
          })),
        },
      },
    });
  }

  console.log("Seed complete!");
  console.log("Admin login: admin@shiftshappn.com / admin123");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
