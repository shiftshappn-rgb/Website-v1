import { useState, type ReactNode } from "react";
import { Cloud, Shirt, Wind } from "lucide-react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";

export type ProductInfoHighlight = {
  label: string;
  icon: "pockets" | "soft" | "antiWrinkle";
};

export type ProductInfoTabsProps = {
  intro?: string | null;
  note?: ReactNode;
  features: string[];
  fitSummary?: string | null;
  lengthGuide?: string | null;
  fabricName?: string | null;
  fabricDescription?: string | null;
  careInstructions?: string | null;
  fabricHref?: string;
  onOpenSizeChart?: () => void;
  highlights?: ProductInfoHighlight[];
};

const DEFAULT_HIGHLIGHTS: ProductInfoHighlight[] = [
  { label: "Mobile-ready pockets", icon: "pockets" },
  { label: "Ridiculously soft", icon: "soft" },
  { label: "Anti-wrinkle", icon: "antiWrinkle" },
];

function HighlightIcon({ icon }: { icon: ProductInfoHighlight["icon"] }) {
  const className = "size-4 text-charcoal/70";
  switch (icon) {
    case "pockets":
      return <Shirt className={className} aria-hidden strokeWidth={1.5} />;
    case "soft":
      return <Cloud className={className} aria-hidden strokeWidth={1.5} />;
    case "antiWrinkle":
      return <Wind className={className} aria-hidden strokeWidth={1.5} />;
  }
}

export function ProductInfoTabs({
  intro,
  note,
  features,
  fitSummary,
  lengthGuide,
  fabricName,
  fabricDescription,
  careInstructions,
  fabricHref = "/shiftknit",
  onOpenSizeChart,
  highlights = DEFAULT_HIGHLIGHTS,
}: ProductInfoTabsProps) {
  const [tab, setTab] = useState<"details" | "fit" | "fabric">("details");

  return (
    <section className="mt-14">
      <div
        className="flex rounded-full bg-[#efeee9] p-1"
        role="tablist"
        aria-label="Product information"
      >
        {(["details", "fit", "fabric"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "h-11 flex-1 rounded-full text-[13px] capitalize transition-colors",
              tab === id
                ? "bg-white font-medium text-charcoal shadow-sm"
                : "text-charcoal/50 hover:text-charcoal/70"
            )}
          >
            {id}
          </button>
        ))}
      </div>

      <div className="px-1 py-8 text-[15px] leading-7 text-charcoal/80">
        {tab === "details" && (
          <div className="space-y-4">
            {intro ? <p>{intro}</p> : null}
            {note ? <p className="text-charcoal/65">{note}</p> : null}
            {features.length > 0 && (
              <ul className="list-disc space-y-1.5 pl-5">
                {features.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "fit" && (
          <div className="space-y-3">
            <p className="whitespace-pre-line">
              {fitSummary?.trim() ||
                "Classic fit. Runs true to size. If you are between sizes, size up."}
            </p>
            {lengthGuide ? <p>{lengthGuide}</p> : null}
            {onOpenSizeChart ? (
              <button
                type="button"
                onClick={onOpenSizeChart}
                className="underline underline-offset-4 hover:text-navy"
              >
                Size chart
              </button>
            ) : null}
          </div>
        )}

        {tab === "fabric" && (
          <div className="space-y-3">
            {fabricName ? (
              <>
                <p className="font-medium text-charcoal">{fabricName}</p>
                {fabricDescription ? <p>{fabricDescription}</p> : null}
              </>
            ) : (
              <p>
                Every style is made in{" "}
                <Link
                  to={fabricHref}
                  className="font-medium text-charcoal underline underline-offset-4 hover:text-navy"
                >
                  SHIFTKNIT™
                </Link>
                — soft 4-way stretch that keeps up through a long shift.
              </p>
            )}
            {careInstructions ? (
              <p className="whitespace-pre-line">{careInstructions}</p>
            ) : (
              <p>Machine wash cold. Tumble dry low. Do not bleach.</p>
            )}
          </div>
        )}
      </div>

      {highlights.length > 0 && (
        <ul className="grid gap-5 border-t border-charcoal/10 px-1 pt-8 sm:grid-cols-3">
          {highlights.map((item) => (
            <li key={item.label} className="flex items-center gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-charcoal/20">
                <HighlightIcon icon={item.icon} />
              </span>
              <span className="text-[14px] font-medium text-charcoal">
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
