export type PackShowcaseItem = {
  kind: "set" | "extra";
  name: string;
  imagePublicId?: string;
};

export type PackShowcaseSummary = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  basePrice: number;
  compareAtPrice?: number | null;
  href: string;
  imagePublicId?: string;
  imageAlt?: string;
  images: Array<{ publicId: string; alt: string }>;
  items: PackShowcaseItem[];
};
