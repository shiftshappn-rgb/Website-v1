/**
 * Multi-beat ECG strip matching the logo QRS motif.
 * Stroke length is measured once so dashoffset draw works across viewBox scales.
 */
export function HeroEcgLine({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
    >
      <path
        className="hero-ecg-path"
        d="M0 60 H80 L100 60 L115 18 L130 102 L145 60 H220 L235 60 L250 18 L265 102 L280 60 H360 L375 60 L390 18 L405 102 L420 60 H500 L515 60 L530 18 L545 102 L560 60 H640 L655 60 L670 18 L685 102 L700 60 H780 L795 60 L810 18 L825 102 L840 60 H920 L935 60 L950 18 L965 102 L980 60 H1200"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
      />
    </svg>
  );
}
