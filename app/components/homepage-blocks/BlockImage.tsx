import { cn } from "~/lib/utils";

export function getCloudinaryUrl(
  publicId: string,
  width: number,
  cloudName?: string
): string | null {
  if (!cloudName || !publicId) return null;
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
}

export function BlockImage({
  publicId,
  alt = "",
  width,
  cloudName,
  className,
  placeholderClassName,
}: {
  publicId?: string;
  alt?: string;
  width: number;
  cloudName?: string;
  className?: string;
  placeholderClassName?: string;
}) {
  const url = publicId ? getCloudinaryUrl(publicId, width, cloudName) : null;

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
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}
