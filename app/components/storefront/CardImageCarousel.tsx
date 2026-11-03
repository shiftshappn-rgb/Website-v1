import { Link } from "react-router";
import { cloudinaryImageUrl, cloudinarySrcSet } from "~/lib/cloudinary";
import { cn } from "~/lib/utils";

const CARD_WIDTHS = [320, 480, 600, 800];

export function CardImageCarousel({
  images,
  alt,
  href,
  cloudName,
  className,
  imageClassName,
  maxImages,
  padded = false,
}: {
  images: Array<{ publicId: string; alt?: string }>;
  alt: string;
  href?: string;
  cloudName?: string;
  className?: string;
  imageClassName?: string;
  /** Cap slides (e.g. homepage best sellers = 2). */
  maxImages?: number;
  /** Leave soft background visible above/below the product. */
  padded?: boolean;
}) {
  const slides =
    maxImages != null && maxImages > 0 ? images.slice(0, maxImages) : images;
  const primary = slides[0];
  const secondary = slides[1];

  const primarySrc = primary
    ? cloudinaryImageUrl(primary.publicId, cloudName, 600) ??
      (primary.publicId.startsWith("http") || primary.publicId.startsWith("/")
        ? primary.publicId
        : null)
    : null;
  const primarySrcSet = primary
    ? cloudinarySrcSet(primary.publicId, cloudName, CARD_WIDTHS)
    : null;
  const secondarySrc = secondary
    ? cloudinaryImageUrl(secondary.publicId, cloudName, 600) ??
      (secondary.publicId.startsWith("http") || secondary.publicId.startsWith("/")
        ? secondary.publicId
        : null)
    : null;
  const secondarySrcSet = secondary
    ? cloudinarySrcSet(secondary.publicId, cloudName, CARD_WIDTHS)
    : null;

  const fitClass = padded ? "object-contain" : "object-cover";

  const media = (
    <div
      className={cn(
        "relative aspect-[3/4] w-full overflow-hidden bg-card-soft",
        padded && "px-3 py-5 sm:px-4 sm:py-6"
      )}
    >
      <div className="relative h-full w-full">
        {primarySrc ? (
          <img
            src={primarySrc}
            srcSet={primarySrcSet ?? undefined}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
            alt={primary?.alt || alt}
            loading="lazy"
            decoding="async"
            className={cn(
              "absolute inset-0 h-full w-full transition-opacity duration-300",
              fitClass,
              secondarySrc && "group-hover:opacity-0",
              imageClassName
            )}
          />
        ) : (
          <div className={cn("absolute inset-0 bg-card-soft", imageClassName)} />
        )}
        {secondarySrc ? (
          <img
            src={secondarySrc}
            srcSet={secondarySrcSet ?? undefined}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
            alt={secondary?.alt || alt}
            loading="lazy"
            decoding="async"
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100",
              fitClass,
              imageClassName
            )}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-card-soft [transform:translateZ(0)]",
        className
      )}
    >
      {href ? (
        <Link to={href} prefetch="intent" className="block" tabIndex={-1} aria-hidden>
          {media}
        </Link>
      ) : (
        media
      )}
    </div>
  );
}
