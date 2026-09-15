export const CATALOG_COLORS = {
  Navy: "#1D4E78",
  White: "#F7F4EE",
  Sage: "#8FA68E",
  Charcoal: "#111A22",
  "Cloud Grey": "#C4C8CE",
  "Powder Blue": "#B7D4E8",
  Black: "#161616",
  Lavender: "#C9B6D6",
  "Dusty Rose": "#B07A7A",
} as const;

export const CATALOG_SIZES = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "2XL",
  "3XL",
  "4XL",
  "5XL",
] as const;

export const CATALOG_LENGTHS = ["Jogger", "Straight", "Tall"] as const;

export type CatalogColorName = keyof typeof CATALOG_COLORS;

export type CatalogStyle = {
  id: string;
  slug: string;
  name: string;
  features: string[];
  colors: CatalogColorName[];
  audience: "women" | "men";
  topPrice: number;
  pantsPrice: number;
};

export const CATALOG_STYLES: CatalogStyle[] = [
  {
    id: "SH-001",
    slug: "nova",
    name: "Nova",
    features: [
      "SHIFTKNIT construction",
      "Premium stretch fabric",
      "Tapered fit",
      "Reinforced seams",
      "Deep pockets",
    ],
    colors: ["Navy", "White", "Sage", "Charcoal"],
    audience: "women",
    topPrice: 44,
    pantsPrice: 48,
  },
  {
    id: "SH-002",
    slug: "zephyr",
    name: "Zephyr",
    features: [
      "TRI-BAY panel design",
      "Lightweight breathable fabric",
      "High-rise waist",
      "Mobile-ready pockets",
      "Relaxed fit",
    ],
    colors: ["Navy", "White", "Sage", "Charcoal", "Cloud Grey"],
    audience: "women",
    topPrice: 46,
    pantsPrice: 50,
  },
  {
    id: "SH-003",
    slug: "luna",
    name: "Luna",
    features: [
      "BACKLINE system",
      "Sculpted design",
      "Contrast binding detail",
      "Moisture-wicking fabric",
      "Curved seams",
    ],
    colors: ["Navy", "White", "Sage", "Charcoal", "Powder Blue"],
    audience: "women",
    topPrice: 48,
    pantsPrice: 52,
  },
  {
    id: "SH-004",
    slug: "eclipse",
    name: "Eclipse",
    features: [
      "Premium blend fabric",
      "Minimalist design",
      "Flat-front waist",
      "Reinforced pockets",
      "Professional fit",
    ],
    colors: ["Navy", "Charcoal", "Black"],
    audience: "men",
    topPrice: 45,
    pantsPrice: 49,
  },
  {
    id: "SH-005",
    slug: "aura",
    name: "Aura",
    features: [
      "Soft stretch knit",
      "Feminine silhouette",
      "Curved panel construction",
      "Double-stitched seams",
      "All-day comfort",
    ],
    colors: ["White", "Sage", "Cloud Grey", "Lavender"],
    audience: "women",
    topPrice: 46,
    pantsPrice: 50,
  },
  {
    id: "SH-006",
    slug: "edge",
    name: "Edge",
    features: [
      "Contemporary cut",
      "Structured fabric",
      "Slim profile",
      "Utility pocket placement",
      "Modern aesthetic",
    ],
    colors: ["Navy", "Charcoal", "White", "Sage"],
    audience: "women",
    topPrice: 47,
    pantsPrice: 51,
  },
];

export type CatalogProduct = {
  styleId: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  basePrice: number;
  audience: "women" | "men";
  piece: "top" | "pants";
  colors: Array<{ name: string; hex: string }>;
};

export function buildCatalogProducts(): CatalogProduct[] {
  return CATALOG_STYLES.flatMap((style) => {
    const featureCopy = style.features.join(" • ");
    const colors = style.colors.map((name) => ({
      name,
      hex: CATALOG_COLORS[name],
    }));

    return [
      {
        styleId: style.id,
        slug: `${style.slug}-top`,
        name: `${style.name} top`,
        description: `${style.name} scrub top. ${featureCopy}. Available XS–3XL.`,
        shortDescription: style.features.slice(0, 3).join(" • "),
        basePrice: style.topPrice,
        audience: style.audience,
        piece: "top" as const,
        colors,
      },
      {
        styleId: style.id,
        slug: `${style.slug}-pants`,
        name: `${style.name} pants`,
        description: `${style.name} scrub pants. ${featureCopy}. Available XS–3XL.`,
        shortDescription: style.features.slice(0, 3).join(" • "),
        basePrice: style.pantsPrice,
        audience: style.audience,
        piece: "pants" as const,
        colors,
      },
    ];
  });
}

export function catalogSku(
  styleId: string,
  piece: "top" | "pants",
  colorName: string,
  size: string
) {
  const color = colorName.toUpperCase().replace(/\s+/g, "-");
  const pieceCode = piece === "top" ? "T" : "B";
  return `${styleId}-${pieceCode}-${color}-${size}`;
}

/** Admin / storefront variant SKU: `{product-slug}-{COLOR}-{SIZE}` */
export function buildVariantSku(productSlug: string, colorName: string, size: string) {
  const color = colorName.trim().toUpperCase().replace(/\s+/g, "-");
  const sizeCode = size.trim().toUpperCase();
  return `${productSlug}-${color}-${sizeCode}`;
}
