export function cloudinaryImageUrl(
  publicId: string,
  cloudName: string | null | undefined,
  width?: number
): string | null {
  if (!publicId) return null;
  if (publicId.startsWith("http://") || publicId.startsWith("https://")) {
    return publicId;
  }
  if (!cloudName) return null;

  const transforms = ["f_auto", "q_auto", width ? `w_${width}` : null]
    .filter(Boolean)
    .join(",");

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`;
}
