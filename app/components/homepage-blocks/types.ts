export type HomepageBlockType =
  | "hero"
  | "marquee"
  | "quickShopRow"
  | "categoryDuo"
  | "productGrid"
  | "bundleBanner"
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
  womenLabel: string;
  womenLink: string;
  womenImagePublicId?: string;
  womenBgColor?: string;
  menLabel: string;
  menLink: string;
  menImagePublicId?: string;
  menBgColor?: string;
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
  basePrice: number | string;
  compareAtPrice?: number | string | null;
  imagePublicId?: string;
  imageAlt?: string;
  colors?: ProductColorSwatch[];
}

export interface BlockCommonProps {
  cloudName?: string;
}
