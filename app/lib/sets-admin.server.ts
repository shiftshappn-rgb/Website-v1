import { db } from "~/db.server";
import { piecePrices } from "~/lib/sets";

export type SetCatalogProduct = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  status: string;
  categorySlug: string | null;
};

export type AdminSetListItem = {
  id: string;
  name: string;
  slug: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  topName: string;
  pantsName: string;
  sum: number;
  sellPrice: number;
  updatedAt: string;
  packCount: number;
};

const productSelect = {
  id: true,
  name: true,
  slug: true,
  basePrice: true,
  status: true,
  category: { select: { slug: true } },
} as const;

function isTopCategory(slug: string | null | undefined) {
  return Boolean(slug && slug.endsWith("-tops"));
}

function isPantsCategory(slug: string | null | undefined) {
  return Boolean(slug && slug.endsWith("-pants"));
}

export async function listCatalogProductsForSets(): Promise<{
  tops: SetCatalogProduct[];
  pants: SetCatalogProduct[];
}> {
  const products = await db.product.findMany({
    where: { status: { in: ["active", "draft"] } },
    orderBy: { name: "asc" },
    select: productSelect,
  });

  const mapped = products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    basePrice: Number(product.basePrice),
    status: product.status,
    categorySlug: product.category?.slug ?? null,
  }));

  return {
    tops: mapped.filter((product) => isTopCategory(product.categorySlug)),
    pants: mapped.filter((product) => isPantsCategory(product.categorySlug)),
  };
}

export async function listAdminSets(): Promise<AdminSetListItem[]> {
  const bundles = await db.bundle.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      products: {
        include: {
          product: { select: { id: true, name: true, basePrice: true } },
        },
      },
      _count: { select: { packItems: true } },
    },
  });

  return bundles.flatMap((bundle) => {
    const top = bundle.products.find((item) => item.role === "top")?.product;
    const pants = bundle.products.find((item) => item.role === "pants")?.product;
    if (!top || !pants) return [];

    const topPrice = Number(top.basePrice);
    const pantsPrice = Number(pants.basePrice);
    const prices = piecePrices(
      topPrice,
      pantsPrice,
      bundle.discountType,
      Number(bundle.discountValue)
    );

    return [
      {
        id: bundle.id,
        name: bundle.name,
        slug: bundle.slug,
        discountType: bundle.discountType,
        discountValue: Number(bundle.discountValue),
        topName: top.name,
        pantsName: pants.name,
        sum: topPrice + pantsPrice,
        sellPrice: prices.total,
        updatedAt: bundle.updatedAt.toISOString(),
        packCount: bundle._count.packItems,
      },
    ];
  });
}

export async function getAdminSet(id: string) {
  const bundle = await db.bundle.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          product: { select: { id: true, name: true, basePrice: true } },
        },
      },
      _count: { select: { packItems: true } },
    },
  });
  if (!bundle) return null;

  const top = bundle.products.find((item) => item.role === "top")?.product;
  const pants = bundle.products.find((item) => item.role === "pants")?.product;
  if (!top || !pants) return null;

  return {
    id: bundle.id,
    name: bundle.name,
    slug: bundle.slug,
    description: bundle.description,
    discountType: bundle.discountType as "fixed" | "percent",
    discountValue: Number(bundle.discountValue),
    topProductId: top.id,
    pantsProductId: pants.id,
    topName: top.name,
    pantsName: pants.name,
    packCount: bundle._count.packItems,
  };
}

async function assertProductsAvailableForSet(
  topProductId: string,
  pantsProductId: string,
  excludeBundleId?: string
) {
  if (topProductId === pantsProductId) {
    throw new Error("Choose different products for top and pants.");
  }

  const products = await db.product.findMany({
    where: { id: { in: [topProductId, pantsProductId] } },
    select: {
      id: true,
      name: true,
      category: { select: { slug: true } },
      bundleItems: {
        include: { bundle: { select: { id: true, name: true } } },
      },
    },
  });

  if (products.length !== 2) {
    throw new Error("One or more products could not be found.");
  }

  const top = products.find((product) => product.id === topProductId);
  const pants = products.find((product) => product.id === pantsProductId);
  if (!top || !pants) {
    throw new Error("One or more products could not be found.");
  }
  if (!isTopCategory(top.category?.slug)) {
    throw new Error(`“${top.name}” is not a top product.`);
  }
  if (!isPantsCategory(pants.category?.slug)) {
    throw new Error(`“${pants.name}” is not a pants product.`);
  }

  for (const product of products) {
    const conflict = product.bundleItems.find(
      (item) => item.bundle.id !== excludeBundleId
    );
    if (conflict) {
      throw new Error(
        `“${product.name}” is already on the “${conflict.bundle.name}” set.`
      );
    }
  }
}

export async function createSet(input: {
  name: string;
  slug: string;
  description: string | null;
  discountType: "fixed" | "percent";
  discountValue: number;
  topProductId: string;
  pantsProductId: string;
}) {
  await assertProductsAvailableForSet(input.topProductId, input.pantsProductId);

  const bundle = await db.bundle.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      discountType: input.discountType,
      discountValue: input.discountValue,
    },
  });

  await db.bundleProduct.create({
    data: {
      bundleId: bundle.id,
      productId: input.topProductId,
      role: "top",
      sortOrder: 0,
    },
  });
  await db.bundleProduct.create({
    data: {
      bundleId: bundle.id,
      productId: input.pantsProductId,
      role: "pants",
      sortOrder: 1,
    },
  });

  return bundle;
}

export async function updateSet(
  id: string,
  input: {
    name: string;
    slug: string;
    description: string | null;
    discountType: "fixed" | "percent";
    discountValue: number;
    topProductId: string;
    pantsProductId: string;
  }
) {
  await assertProductsAvailableForSet(
    input.topProductId,
    input.pantsProductId,
    id
  );

  await db.bundle.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      discountType: input.discountType,
      discountValue: input.discountValue,
    },
  });

  await db.bundleProduct.deleteMany({ where: { bundleId: id } });
  await db.bundleProduct.create({
    data: {
      bundleId: id,
      productId: input.topProductId,
      role: "top",
      sortOrder: 0,
    },
  });
  await db.bundleProduct.create({
    data: {
      bundleId: id,
      productId: input.pantsProductId,
      role: "pants",
      sortOrder: 1,
    },
  });
}

export async function deleteSet(id: string) {
  const packCount = await db.packItem.count({ where: { bundleId: id } });
  if (packCount > 0) {
    throw new Error(
      "This set is used by one or more promo bundles. Remove it from those bundles first."
    );
  }
  await db.bundle.delete({ where: { id } });
}
