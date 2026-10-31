import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

export type GalleryImage = {
  publicId: string;
  altText?: string;
};

export function ProductGallery({
  images,
  activeIndex,
  onChange,
  alt,
  imageSrc,
}: {
  images: GalleryImage[];
  activeIndex: number;
  onChange: (index: number) => void;
  alt: string;
  imageSrc: (publicId: string, width: number) => string;
}) {
  const safeIndex = images.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), images.length - 1);
  const current = images[safeIndex];
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    thumbRefs.current[safeIndex]?.scrollIntoView({ block: "nearest" });
  }, [safeIndex]);

  function step(direction: -1 | 1) {
    if (images.length < 2) return;
    onChange((safeIndex + direction + images.length) % images.length);
  }

  return (
    <div
      className={cn(
        "grid items-stretch gap-2 sm:gap-3",
        images.length > 1 && "grid-cols-[4.25rem_minmax(0,1fr)] sm:grid-cols-[5.25rem_minmax(0,1fr)]"
      )}
    >
      {images.length > 1 && (
        <div className="relative min-h-0">
          <div className="absolute inset-0 flex flex-col gap-2 overflow-y-auto">
            {images.map((image, index) => (
              <button
                key={`${image.publicId}-${index}`}
                ref={(node) => {
                  thumbRefs.current[index] = node;
                }}
                type="button"
                onClick={() => onChange(index)}
                aria-label={`Show image ${index + 1}`}
                aria-current={index === safeIndex ? "true" : undefined}
                className={cn(
                  "aspect-3/4 shrink-0 overflow-hidden bg-[#f6f6f4]",
                  index === safeIndex ? "ring-1 ring-charcoal" : "opacity-80 hover:opacity-100"
                )}
              >
                <img
                  src={imageSrc(image.publicId, 200)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-top"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative min-h-0 bg-[#f6f6f4]">
        <div className="aspect-3/4">
          {current ? (
            <img
              src={imageSrc(current.publicId, 900)}
              srcSet={`${imageSrc(current.publicId, 600)} 600w, ${imageSrc(current.publicId, 900)} 900w, ${imageSrc(current.publicId, 1200)} 1200w`}
              sizes="(max-width: 768px) 100vw, 50vw"
              alt={current.altText || alt}
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-contain object-center"
            />
          ) : (
            <div className="h-full w-full bg-[#f6f6f4]" />
          )}
        </div>
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-charcoal shadow-sm"
              onClick={() => step(-1)}
              aria-label="Previous image"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-charcoal shadow-sm"
              onClick={() => step(1)}
              aria-label="Next image"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
