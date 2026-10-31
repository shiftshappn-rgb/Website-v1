import { cloudinaryImageUrl, cloudinarySrcSet } from "~/lib/cloudinary";
import { cn } from "~/lib/utils";

export function getCloudinaryUrl(
  publicId: string,
  width: number,
  cloudName?: string
): string | null {
  return cloudinaryImageUrl(publicId, cloudName, width);
}

export function BlockImage({
  publicId,
  alt = "",
  width,
  cloudName,
  className,
  placeholderClassName,
  priority = false,
}: {
  publicId?: string;
  alt?: string;
  width: number;
  cloudName?: string;
  className?: string;
  placeholderClassName?: string;
  priority?: boolean;
}) {
  const url = publicId ? getCloudinaryUrl(publicId, width, cloudName) : null;
  const srcSet = publicId
    ? cloudinarySrcSet(
        publicId,
        cloudName,
        [Math.round(width * 0.5), width, Math.round(width * 1.5)].filter(
          (value, index, all) => value > 0 && all.indexOf(value) === index
        )
      )
    : null;

  if (!url) {
    return (
      <div
        className={cn("bg-stone", placeholderClassName, className)}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={url}
      srcSet={srcSet ?? undefined}
      sizes={srcSet ? `(max-width: 768px) 100vw, ${width}px` : undefined}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}
