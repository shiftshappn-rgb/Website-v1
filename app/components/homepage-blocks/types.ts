export type HomepageBlockType =
  | "hero"
  | "marquee"
  | "quickShopRow"
  | "categoryDuo"
  | "productGrid"
  | "bundleBanner"
  | "packShowcase"
  | "sizeFinderStrip"
  | "fabricCallout"
  | "brandStory"
  | "reviewHighlight"
  | "valuePropsRow"
  | "giftCardBanner";

export interface HomepageBlock {
  id: string;
  type: HomepageBlockType;
  order: number;
  content: Record<string, unknown>;
  isActive?: boolean;
}

export type HomepageBlockContent =
  | HeroContent
  | MarqueeContent
  | QuickShopRowContent
  | CategoryDuoContent
  | ProductGridContent
  | BundleBannerContent
  | PackShowcaseContent
  | SizeFinderStripContent
  | FabricCalloutContent
  | BrandStoryContent
  | ReviewHighlightContent
  | ValuePropsRowContent
  | GiftCardBannerContent;

export interface HeroContent {
  headline: string;
  subheadline?: string;
  body?: string;
  ctaLabel: string;
  ctaLink: string;
  imagePublicId?: string;
  imageAlt?: string;
  badge?: string;
}

export interface MarqueeContent {
  items: string[];
}

export interface QuickShopRowContent {
  items: { label: string; link: string; icon?: string }[];
}

export interface CategoryDuoContent {
  headline?: string;
  body?: string;
  womenLabel: string;
  womenLink: string;
  womenSubline?: string;
  womenImagePublicId?: string;
  womenBgColor?: string;
  menLabel: string;
  menLink: string;
  menSubline?: string;
  menImagePublicId?: string;
  menBgColor?: string;
  featureHeadline?: string;
  featureBody?: string;
  featureCtaLabel?: string;
  featureCtaLink?: string;
}

export interface ProductGridContent {
  headline: string;
  collectionSlug?: string;
  productSlugs?: string[];
  layout?: "grid" | "carousel";
}

export interface BundleBannerContent {
  badge?: string;
  headline: string;
  body?: string;
  ctaLabel: string;
  ctaLink: string;
}

export interface PackShowcaseContent {
  headline: string;
  body?: string;
  packSlugs: string[];
  ctaLabel?: string;
  ctaLink?: string;
}

export type { PackShowcaseItem, PackShowcaseSummary } from "~/lib/packs";

export interface SizeFinderStripContent {
  text: string;
  ctaLabel: string;
  ctaLink: string;
}

export interface FabricCalloutContent {
  headline: string;
  subheadline?: string;
  features: string[];
  specs: string[];
  imagePublicId?: string;
}

export interface BrandStoryContent {
  badge?: string;
  headline: string;
  body?: string;
  ctaLabel: string;
  ctaLink: string;
  imagePublicId?: string;
}

export interface ReviewItem {
  quote: string;
  author: string;
  rating?: number;
  verified?: boolean;
}

export interface ReviewHighlightContent {
  quote?: string;
  author?: string;
  rating?: number;
  verified?: boolean;
  reviews?: ReviewItem[];
}

export interface ValuePropsRowContent {
  items: { label: string; icon?: string }[];
}

export interface GiftCardBannerContent {
  badge?: string;
  headline: string;
  body?: string;
  ctaLabel: string;
  ctaLink: string;
  amounts?: number[];
  previewAmount?: number;
}

export interface ProductColorSwatch {
  name: string;
  hex: string;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string;
  basePrice: number | string;
  compareAtPrice?: number | string | null;
  imagePublicId?: string;
  imageAlt?: string;
  images?: Array<{ publicId: string; alt: string }>;
  colors?: ProductColorSwatch[];
  href?: string;
}

export interface BlockCommonProps {
  cloudName?: string;
}
