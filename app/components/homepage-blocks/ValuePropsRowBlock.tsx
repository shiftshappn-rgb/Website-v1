import type { CSSProperties } from "react";
import { useScrollReveal } from "~/lib/use-scroll-reveal";
import { BlockIcon } from "./iconMap";
import type { BlockCommonProps, ValuePropsRowContent } from "./types";

export function ValuePropsRowBlock({
  content,
}: BlockCommonProps & { content: ValuePropsRowContent }) {
  const revealRef = useScrollReveal<HTMLElement>();

  return (
    <section ref={revealRef} className="section-charcoal py-10 lg:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {content.items.map((item, index) => (
            <div
              key={item.label}
              className="animate-on-scroll flex flex-col items-center text-center gap-3"
              style={{ "--stagger-delay": `${index * 80}ms` } as CSSProperties}
            >
              <span
                className="animate-icon-pulse"
                style={{ "--stagger-delay": `${index * 80}ms` } as CSSProperties}
              >
                <BlockIcon
                  name={item.icon}
                  className="h-5 w-5 text-gold"
                />
              </span>
              <p className="text-sm font-medium text-white leading-snug max-w-40">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
