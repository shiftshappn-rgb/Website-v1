import type { CSSProperties } from "react";
import { Link } from "react-router";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import { BlockIcon } from "./iconMap";
import type { BlockCommonProps, QuickShopRowContent } from "./types";

export function QuickShopRowBlock({
  content,
}: BlockCommonProps & { content: QuickShopRowContent }) {
  const revealRef = useScrollReveal<HTMLElement>();

  return (
    <section ref={revealRef} className="section-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
          {content.items.map((item, index) => (
            <div
              key={item.link + item.label}
              className="animate-on-scroll shrink-0 snap-start"
              style={{ "--stagger-delay": `${index * 60}ms` } as CSSProperties}
            >
              <Link
                to={item.link}
                className="inline-flex min-h-11 items-center gap-2.5 rounded-full bg-sand px-5 py-3 text-sm font-medium text-charcoal shadow-sm transition-all duration-300 hover:scale-105 hover:bg-navy hover:text-white hover:shadow-md"
              >
                <BlockIcon name={item.icon} className="h-4 w-4" />
                {item.label}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
