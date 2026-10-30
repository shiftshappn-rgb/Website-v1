import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

export function StarRating({
  value,
  size = 16,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));

  return (
    <div
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, index) => {
        const fill = Math.max(0, Math.min(1, clamped - index));
        return (
          <span
            key={index}
            className="relative inline-flex"
            style={{ width: size, height: size }}
          >
            <Star
              size={size}
              className="absolute inset-0 text-charcoal/20"
              aria-hidden
            />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  size={size}
                  className="fill-charcoal text-charcoal"
                  aria-hidden
                />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
