import { useEffect, type CSSProperties } from "react";
import { ArrowRight, X } from "lucide-react";
import { Link, useLocation } from "react-router";
import { cn } from "~/lib/utils";

const menuLinks = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Women", href: "/shop/women" },
  { label: "Men", href: "/shop/men" },
  { label: "Bundles", href: "/collections/bundles" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

const ribbonCopy =
  "  *  SHIFTSHAPPN  *  scrubs made for the shift  ".repeat(8);

type FullscreenMenuProps = {
  open: boolean;
  onClose: () => void;
};

function Ribbon() {
  const path =
    "M 180 760 C 340 790, 520 700, 640 600 C 790 480, 920 360, 880 230 C 840 110, 680 90, 640 220 C 600 350, 790 410, 960 500 C 1080 560, 1160 640, 1180 720";

  return (
    <div className="menu-ribbon pointer-events-none absolute inset-y-8 right-6 left-[28%] hidden sm:block sm:inset-y-10 sm:right-10 sm:left-[22%] lg:left-[36%] lg:right-14">
      <svg
        className="h-full w-full"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMaxYMid meet"
        aria-hidden
      >
        <defs>
          <filter
            id="menu-ribbon-depth"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx="10"
              dy="18"
              stdDeviation="10"
              floodColor="#111a22"
              floodOpacity="0.55"
            />
          </filter>
        </defs>
        <path
          d={path}
          fill="none"
          stroke="#8a6e34"
          strokeWidth="58"
          strokeLinecap="round"
          transform="translate(14 16)"
        />
        <path
          id="menu-ribbon-path"
          d={path}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="52"
          strokeLinecap="round"
          filter="url(#menu-ribbon-depth)"
        />
        <text className="menu-ribbon-text">
          <textPath href="#menu-ribbon-path" method="align" spacing="auto">
            {ribbonCopy}
            <animate
              attributeName="startOffset"
              from="0%"
              to="-35%"
              dur="22s"
              repeatCount="indefinite"
            />
          </textPath>
        </text>
      </svg>
    </div>
  );
}

export function FullscreenMenu({ open, onClose }: FullscreenMenuProps) {
  const location = useLocation();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  function isActive(href: string) {
    if (href === "/") return location.pathname === "/";
    if (href === "/shop") return location.pathname === "/shop";
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  }

  return (
    <div
      className="animate-menu-in fixed inset-0 z-[100] overflow-hidden bg-charcoal text-gold"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_55%,rgba(201,165,90,0.12),transparent_58%)]" />
      <Ribbon />

      <button
        type="button"
        onClick={onClose}
        className="absolute top-[max(2rem,env(safe-area-inset-top))] right-[max(2rem,env(safe-area-inset-right))] z-20 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-charcoal shadow-[0_12px_28px_rgba(17,26,34,0.45)] transition-transform hover:scale-105 sm:top-10 sm:right-12 lg:top-12 lg:right-16"
        aria-label="Close menu"
      >
        <X size={20} />
      </button>

      <nav className="pointer-events-none relative z-10 flex min-h-full flex-col justify-center px-8 py-28 sm:px-14 lg:px-20 xl:px-24">
        <p className="mb-8 text-[11px] font-semibold uppercase tracking-[0.28em] text-gold/55 sm:mb-10">
          Menu
        </p>
        <ul className="pointer-events-auto flex max-w-xl flex-col gap-3 sm:gap-4">
          {menuLinks.map((link, index) => {
            const active = isActive(link.href);
            return (
              <li
                key={link.href}
                className="animate-menu-link"
                style={{ "--stagger-delay": `${80 + index * 55}ms` } as CSSProperties}
              >
                <Link
                  to={link.href}
                  prefetch="intent"
                  onClick={onClose}
                  className={cn(
                    "group relative inline-flex min-h-11 items-center pl-12 font-sans text-3xl font-extrabold tracking-tight transition-colors sm:min-h-12 sm:pl-14 sm:text-4xl lg:text-5xl",
                    active ? "text-gold" : "text-gold/80 hover:text-gold"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-gold text-charcoal shadow-[0_8px_18px_rgba(17,26,34,0.35)] transition-all duration-300 sm:size-9",
                      active
                        ? "scale-100 opacity-100"
                        : "scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100"
                    )}
                    aria-hidden
                  >
                    <ArrowRight className="size-3.5" />
                  </span>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
