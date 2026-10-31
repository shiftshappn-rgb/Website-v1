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
  width?: number
): string | null {
  if (!publicId) return null;
  if (isAbsoluteOrLocal(publicId)) return publicId;
  if (!cloudName) return null;

  const transforms = ["f_auto", "q_auto", width ? `w_${width}` : null]
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
