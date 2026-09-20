import { formatCurrency } from "~/lib/utils";

export function GiftCardPreview({
  amount,
  compact = false,
}: {
  amount: number;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] bg-sky text-white shadow-[0_24px_60px_-24px_rgba(17,26,34,0.35)] ${
        compact ? "aspect-[4/5] max-h-[420px]" : "aspect-[4/5] min-h-[420px] lg:min-h-[520px]"
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_42%),radial-gradient(circle_at_80%_80%,rgba(29,78,120,0.35),transparent_48%)]" />
      <div className="relative flex h-full flex-col items-center justify-between px-8 py-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/80">
          E-gift card
        </p>

        <div className="space-y-4">
          <svg
            viewBox="0 0 120 88"
            className="mx-auto h-16 w-24 text-white/90"
            fill="none"
            aria-hidden
          >
            <rect x="8" y="24" width="104" height="56" rx="8" stroke="currentColor" strokeWidth="3" />
            <path d="M8 36h104" stroke="currentColor" strokeWidth="3" />
            <path d="M60 24v-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M48 14h24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="36" cy="52" r="6" fill="currentColor" />
            <circle cx="84" cy="52" r="6" fill="currentColor" />
          </svg>
          <p className="font-serif text-[clamp(1.75rem,4vw,2.75rem)] leading-none">
            A gift for you
          </p>
          <p className="text-3xl font-bold tracking-tight lg:text-4xl">
            {formatCurrency(amount)}
          </p>
        </div>

        <div>
          <div className="mx-auto mb-3 h-px w-24 bg-white/40" />
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-white/85">
            ShiftsHappn
          </p>
        </div>
      </div>
    </div>
  );
}
