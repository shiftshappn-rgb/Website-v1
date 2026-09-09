import { CATALOG_COLORS } from "~/lib/product-catalog";
import { slugify } from "~/lib/utils";
import { tryDb } from "~/db.server";

export type CatalogColorOption = {
  id: string;
  name: string;
  slug: string;
  hex: string;
  sortOrder: number;
};

function normalizeHex(hex: string) {
  const value = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value.toUpperCase();
  if (/^[0-9A-Fa-f]{6}$/.test(value)) return `#${value.toUpperCase()}`;
  return null;
}

export async function listCatalogColors(): Promise<CatalogColorOption[]> {
  const db = tryDb();
  if (!db?.catalogColor) return [];
  await ensureCatalogColors();
  return db.catalogColor.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function ensureCatalogColors() {
  const db = tryDb();
  if (!db?.catalogColor) return;

  const existing = await db.catalogColor.findMany({
    select: { name: true, slug: true },
  });
  const byName = new Set(existing.map((color) => color.name.toLowerCase()));
  const bySlug = new Set(existing.map((color) => color.slug));

  const toCreate: Array<{ name: string; hex: string; slug: string; sortOrder: number }> =
    Object.entries(CATALOG_COLORS).map(([name, hex], index) => ({
      name,
      hex,
      slug: slugify(name),
      sortOrder: index,
    }));

  const variantColors = await db.productVariant.findMany({
    distinct: ["colorName"],
    select: { colorName: true, colorHex: true },
  });

  for (const variant of variantColors) {
    const hex = normalizeHex(variant.colorHex);
    if (!hex) continue;
    const name = variant.colorName.trim();
    if (!name) continue;
    if (byName.has(name.toLowerCase())) continue;
    const slug = slugify(name);
    if (bySlug.has(slug) || toCreate.some((color) => color.slug === slug)) continue;
    toCreate.push({
      name,
      hex,
      slug,
      sortOrder: toCreate.length,
    });
  }

  const missing = toCreate.filter(
    (color) => !byName.has(color.name.toLowerCase()) && !bySlug.has(color.slug)
  );

  if (missing.length === 0) return;

  await db.catalogColor.createMany({
    data: missing,
    skipDuplicates: true,
  });
}

export function parseColorHex(value: string) {
  return normalizeHex(value);
}
