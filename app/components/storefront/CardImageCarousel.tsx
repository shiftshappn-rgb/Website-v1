import { useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export function CardImageCarousel({
  images,
  alt,
  href,
  cloudName,
  className,
  imageClassName,
}: {
  images: Array<{ publicId: string; alt?: string }>;
  alt: string;
  href?: string;
  cloudName?: string;
  className?: string;
  imageClassName?: string;
}) {
  const [index, setIndex] = useState(0);
  const count = images.length;
  const current = count > 0 ? images[index % count] : undefined;
  const src = current
    ? current.publicId.startsWith("http")
      ? current.publicId
      : `https://res.cloudinary.com/${cloudName ?? "demo"}/image/upload/f_auto,q_auto,w_600/${current.publicId}`
    : null;

  function step(event: MouseEvent, direction: -1 | 1) {
    event.preventDefault();
    event.stopPropagation();
    setIndex((value) => (value + direction + count) % count);
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-stone", className)}>
      {href ? (
        <Link to={href} prefetch="intent" className="block" tabIndex={-1} aria-hidden>
          {src ? (
            <img
              src={src}
              alt={current?.alt || alt}
              loading="lazy"
              className={cn("aspect-[3/4] w-full object-cover", imageClassName)}
            />
          ) : (
            <div className={cn("aspect-[3/4] w-full bg-stone", imageClassName)} />
          )}
        </Link>
      ) : src ? (
        <img
          src={src}
          alt={current?.alt || alt}
          loading="lazy"
          className={cn("aspect-[3/4] w-full object-cover", imageClassName)}
        />
      ) : (
        <div className={cn("aspect-[3/4] w-full bg-stone", imageClassName)} />
      )}
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={(event) => step(event, -1)}
            className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-charcoal shadow-sm"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={(event) => step(event, 1)}
            className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-charcoal shadow-sm"
          >
            <ChevronRight size={16} />
          </button>
          <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5">
            {images.map((image, imageIndex) => (
              <button
                key={image.publicId}
                type="button"
                aria-label={`Show image ${imageIndex + 1}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIndex(imageIndex);
                }}
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  imageIndex === index % count ? "bg-white" : "bg-white/50"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
