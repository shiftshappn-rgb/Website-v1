export const CHROMA_KEY_ID = "shiftshappn-chroma-key";

/**
 * Keys flat chroma-green studio backdrop out of hero photography so figures
 * composite as cut-outs over the poster wordmark.
 *
 * Alpha ≈ 0.9(R + B) − 1.6G + 0.35, then hard-stepped — green backdrop falls
 * below zero; subject tones stay opaque. Green is pulled slightly toward R/B
 * to suppress edge spill.
 */
export function ChromaKeyFilter() {
  return (
    <svg
      aria-hidden
      focusable="false"
      width={0}
      height={0}
      className="absolute h-0 w-0 overflow-hidden"
    >
      <defs>
        <filter
          id={CHROMA_KEY_ID}
          colorInterpolationFilters="sRGB"
          x="0"
          y="0"
          width="100%"
          height="100%"
        >
          <feColorMatrix
            type="matrix"
            values="
              1    0     0    0 0
              0.08 0.84  0.08 0 0
              0    0     1    0 0
              0.9 -1.6   0.9  0 0.35"
          />
          <feComponentTransfer>
            <feFuncA type="linear" slope="4" intercept="-0.5" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
