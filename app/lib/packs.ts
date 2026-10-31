export type BundleCardPiece = {
  publicId: string;
  alt: string;
};

export type BundleCardData = {
  id: string;
  name: string;
  href: string;
  basePrice: number;
  compareAtPrice: number | null;
  pieceImages: BundleCardPiece[];
};

export type PackShowcaseItem = {
  kind: "primary" | "extra" | "set";
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
  pieceImages: BundleCardPiece[];
  items: PackShowcaseItem[];
};
