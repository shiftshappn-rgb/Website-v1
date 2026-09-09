import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2 } from "lucide-react";
import { CloudinaryUploadButton } from "~/components/admin/CloudinaryUploadButton";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { cn, type VariantImage } from "~/lib/utils";

export function VariantImageGallery({
  images,
  cloudName,
  defaultAlt,
  onChange,
}: {
  images: VariantImage[];
  cloudName: string | null;
  defaultAlt: string;
  onChange: (images: VariantImage[]) => void;
}) {
  const [items, setItems] = useState(images);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    setItems(images);
  }, [JSON.stringify(images)]);

  function emit(next: VariantImage[]) {
    const normalized = next.map((img, index) => ({
      ...img,
      altText: img.altText.trim() || defaultAlt,
      sortOrder: index,
    }));
    setItems(normalized);
    onChange(normalized);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const current = next[index];
    const swap = next[target];
    if (!current || !swap) return;
    next[index] = swap;
    next[target] = current;
    emit(next);
  }

  function setPrimary(index: number) {
    if (index === 0) return;
    const next = [...items];
    const [picked] = next.splice(index, 1);
    if (!picked) return;
    next.unshift(picked);
    emit(next);
  }

  function removeAt(index: number) {
    if (!confirm("Remove this image from the product?")) return;
    emit(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <CloudinaryUploadButton
          cloudName={cloudName}
          onUpload={(publicId) => {
            emit([
              ...itemsRef.current,
              {
                publicId,
                altText: defaultAlt,
                sortOrder: itemsRef.current.length,
              },
            ]);
          }}
        >
          <div className="flex min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-charcoal/25 bg-sand/40 px-4 py-8 text-center transition-colors hover:border-navy hover:bg-sand/70">
            <ImagePlus className="size-8 text-navy" aria-hidden />
            <span className="text-sm font-medium text-navy">Upload images</span>
            <span className="max-w-xs text-xs text-charcoal/60">
              JPG, PNG, or WebP up to 8MB. Photos are shared across every size of this colour.
            </span>
          </div>
        </CloudinaryUploadButton>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((image, index) => {
              const src = cloudinaryImageUrl(image.publicId, cloudName, 400);
              return (
                <li
                  key={`${image.publicId}-${index}`}
                  className="overflow-hidden rounded-xl border border-charcoal/10 bg-white"
                >
                  <div className="relative aspect-[3/4] bg-sand">
                    {src ? (
                      <img
                        src={src}
                        alt={image.altText || defaultAlt}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center px-3 text-center text-xs text-charcoal/50">
                        {image.publicId}
                      </div>
                    )}
                    {index === 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-navy px-2 py-0.5 text-[11px] font-medium text-white">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="space-y-3 p-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-charcoal">Alt text</span>
                      <input
                        defaultValue={image.altText}
                        key={`${image.publicId}-${image.altText}`}
                        onBlur={(event) => {
                          const altText = event.target.value.trim() || defaultAlt;
                          if (altText === image.altText) return;
                          emit(
                            items.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, altText } : item
                            )
                          );
                        }}
                        className="w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm text-charcoal focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      />
                    </label>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        className={cn(
                          "inline-flex size-11 items-center justify-center rounded-lg border border-charcoal/15 text-navy hover:bg-sand disabled:cursor-not-allowed disabled:opacity-40"
                        )}
                        aria-label="Move image earlier"
                      >
                        <ChevronLeft className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === items.length - 1}
                        className="inline-flex size-11 items-center justify-center rounded-lg border border-charcoal/15 text-navy hover:bg-sand disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Move image later"
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrimary(index)}
                        disabled={index === 0}
                        className="inline-flex size-11 items-center justify-center rounded-lg border border-charcoal/15 text-navy hover:bg-sand disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Set as primary image"
                      >
                        <Star className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAt(index)}
                        className="inline-flex size-11 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                        aria-label="Remove image"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <CloudinaryUploadButton
            cloudName={cloudName}
            label="Add more images"
            onUpload={(publicId) => {
              emit([
                ...itemsRef.current,
                {
                  publicId,
                  altText: defaultAlt,
                  sortOrder: itemsRef.current.length,
                },
              ]);
            }}
          />
        </>
      )}
    </div>
  );
}
