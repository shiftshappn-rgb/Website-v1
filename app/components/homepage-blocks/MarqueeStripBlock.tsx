import type { BlockCommonProps, MarqueeContent } from "./types";

export function MarqueeStripBlock({
  content,
}: BlockCommonProps & { content: MarqueeContent }) {
  const items = content.items.length > 0 ? content.items : ["shiftshappn"];
  const loop = [...items, ...items, ...items, ...items];

  return (
    <section className="section-charcoal overflow-hidden" aria-hidden="true">
      <div className="marquee-viewport py-3">
        <div className="marquee-track">
          {loop.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="inline-flex items-center gap-6 px-6 text-sm font-medium uppercase tracking-[0.28em] text-white/90"
            >
              {item}
              <span className="text-gold" aria-hidden>
                ◆
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
