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

function staticCatalogColors(): CatalogColorOption[] {
  return Object.entries(CATALOG_COLORS).map(([name, hex], index) => ({
    id: `static-${slugify(name)}`,
    name,
    slug: slugify(name),
    hex,
    sortOrder: index,
  }));
}

export async function listCatalogColors(): Promise<CatalogColorOption[]> {
  const db = tryDb();
  if (!db?.catalogColor) return staticCatalogColors();

  try {
    await ensureCatalogColors();
    const rows = await db.catalogColor.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        hex: true,
        sortOrder: true,
      },
    });
    return rows.length > 0 ? rows : staticCatalogColors();
  } catch (error) {
    console.error("listCatalogColors failed:", error);
    return staticCatalogColors();
  }
}

export async function ensureCatalogColors() {
  const db = tryDb();
  if (!db?.catalogColor) return;

  try {
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

    // Avoid Prisma `distinct` — Neon HTTP adapter has flaked on it in production.
    const variantColors = await db.productVariant.findMany({
      select: { colorName: true, colorHex: true },
      take: 2000,
    });
    const seenVariantNames = new Set<string>();

    for (const variant of variantColors) {
      const name = variant.colorName.trim();
      if (!name) continue;
      const nameKey = name.toLowerCase();
      if (seenVariantNames.has(nameKey)) continue;
      seenVariantNames.add(nameKey);

      const hex = normalizeHex(variant.colorHex);
      if (!hex) continue;
      if (byName.has(nameKey)) continue;
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
  } catch (error) {
    // Never block product admin pages on color sync failures.
    console.error("ensureCatalogColors failed:", error);
  }
}

export function parseColorHex(value: string) {
  return normalizeHex(value);
}
