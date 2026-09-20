import { HeroBlock } from "./HeroBlock";
import { MarqueeStripBlock } from "./MarqueeStripBlock";
import { QuickShopRowBlock } from "./QuickShopRowBlock";
import { CategoryDuoBlock } from "./CategoryDuoBlock";
import { ProductGridBlock } from "./ProductGridBlock";
import { BundleBannerBlock } from "./BundleBannerBlock";
import { SizeFinderStripBlock } from "./SizeFinderStripBlock";
import { FabricCalloutBlock } from "./FabricCalloutBlock";
import { BrandStoryBlock } from "./BrandStoryBlock";
import { ReviewHighlightBlock } from "./ReviewHighlightBlock";
import { ValuePropsRowBlock } from "./ValuePropsRowBlock";
import { GiftCardBannerBlock } from "./GiftCardBannerBlock";
import type {
  HomepageBlock,
  ProductGridContent,
  ProductSummary,
} from "./types";

export type { HomepageBlock, ProductSummary } from "./types";

export interface BlockRendererProps {
  blocks: HomepageBlock[];
  cloudName?: string;
  /** Product lists keyed by homepage block id */
  productsByBlockId?: Record<string, ProductSummary[]>;
}

function asContent<T>(content: Record<string, unknown>): T {
  return content as unknown as T;
}

function renderBlock(
  block: HomepageBlock,
  cloudName?: string,
  productsByBlockId?: Record<string, ProductSummary[]>
) {
  const common = { cloudName };

  switch (block.type) {
    case "hero":
      return (
        <HeroBlock
          key={block.id}
          content={asContent<Parameters<typeof HeroBlock>[0]["content"]>(block.content)}
          {...common}
        />
      );
    case "marquee":
      return (
        <MarqueeStripBlock
          key={block.id}
          content={asContent<Parameters<typeof MarqueeStripBlock>[0]["content"]>(block.content)}
          {...common}
        />
      );
    case "quickShopRow":
      return (
        <QuickShopRowBlock
          key={block.id}
          content={asContent<Parameters<typeof QuickShopRowBlock>[0]["content"]>(block.content)}
          {...common}
        />
      );
    case "categoryDuo":
      return (
        <CategoryDuoBlock
          key={block.id}
          content={asContent<Parameters<typeof CategoryDuoBlock>[0]["content"]>(block.content)}
          {...common}
        />
      );
    case "productGrid": {
      const content = asContent<ProductGridContent>(block.content);
      return (
        <ProductGridBlock
          key={block.id}
          content={content}
          products={productsByBlockId?.[block.id] ?? []}
          {...common}
        />
      );
    }
    case "bundleBanner":
      return (
        <BundleBannerBlock
          key={block.id}
          content={asContent<Parameters<typeof BundleBannerBlock>[0]["content"]>(block.content)}
          {...common}
        />
      );
    case "sizeFinderStrip":
      return (
        <SizeFinderStripBlock
          key={block.id}
          content={asContent<Parameters<typeof SizeFinderStripBlock>[0]["content"]>(block.content)}
          {...common}
        />
      );
    case "fabricCallout":
      return (
        <FabricCalloutBlock
          key={block.id}
          content={asContent<Parameters<typeof FabricCalloutBlock>[0]["content"]>(block.content)}
          {...common}
        />
      );
    case "brandStory":
      return (
        <BrandStoryBlock
          key={block.id}
          content={asContent<Parameters<typeof BrandStoryBlock>[0]["content"]>(block.content)}
          {...common}
        />
      );
    case "reviewHighlight":
      return (
        <ReviewHighlightBlock
          key={block.id}
          content={asContent<Parameters<typeof ReviewHighlightBlock>[0]["content"]>(block.content)}
          {...common}
        />
      );
    case "valuePropsRow":
      return (
        <ValuePropsRowBlock
          key={block.id}
          content={asContent<Parameters<typeof ValuePropsRowBlock>[0]["content"]>(block.content)}
          {...common}
        />
      );
    case "giftCardBanner":
      return (
        <GiftCardBannerBlock
          key={block.id}
          content={asContent<Parameters<typeof GiftCardBannerBlock>[0]["content"]>(block.content)}
          {...common}
        />
      );
    default:
      return null;
  }
}

export function BlockRenderer({
  blocks,
  cloudName,
  productsByBlockId,
}: BlockRendererProps) {
  const activeBlocks = blocks
    .filter((block) => block.isActive !== false)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="homepage-blocks">
      {activeBlocks.map((block) => renderBlock(block, cloudName, productsByBlockId))}
    </div>
  );
}
