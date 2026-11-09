function isAbsoluteOrLocal(publicId: string) {
  return (
    publicId.startsWith("http://") ||
    publicId.startsWith("https://") ||
    publicId.startsWith("/")
  );
}

export function cloudinaryImageUrl(
  publicId: string,
  cloudName: string | null | undefined,
  width?: number,
  options?: { quality?: "auto" | "auto:eco" | "auto:good" }
): string | null {
  if (!publicId) return null;
  if (isAbsoluteOrLocal(publicId)) return publicId;
  if (!cloudName) return null;

  const quality = options?.quality ?? "auto";
  // f_auto serves WebP/AVIF when the browser supports it
  const transforms = ["f_auto", `q_${quality}`, "c_limit", width ? `w_${width}` : null]
    .filter(Boolean)
    .join(",");

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`;
}

/** Responsive srcset for Cloudinary public IDs (skips absolute/local paths). */
export function cloudinarySrcSet(
  publicId: string,
  cloudName: string | null | undefined,
  widths: number[]
): string | null {
  if (!publicId || !cloudName || isAbsoluteOrLocal(publicId)) return null;
  return widths
    .map((width) => {
      const url = cloudinaryImageUrl(publicId, cloudName, width);
      return url ? `${url} ${width}w` : null;
    })
    .filter(Boolean)
    .join(", ");
}
