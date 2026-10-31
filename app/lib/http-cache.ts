/** CDN-friendly cache for anonymous catalog HTML. */
export const CATALOG_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

export function catalogHeaders() {
  return {
    "Cache-Control": CATALOG_CACHE_CONTROL,
  };
}
