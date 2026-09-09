import { Link, useLocation } from "react-router";
import { ShoppingBag, Search, User, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "~/lib/cart";
import { CartDrawer } from "~/components/storefront/CartDrawer";
import { FullscreenMenu } from "~/components/storefront/FullscreenMenu";
import { cn } from "~/lib/utils";

const navLinks = [
  { label: "Women", href: "/shop/women" },
  { label: "Men", href: "/shop/men" },
  { label: "Bundles", href: "/collections/bundles" },
];

export function AnnouncementBar() {
  return (
    <div className="bg-navy px-2 py-2 text-center text-xs leading-snug tracking-wide text-white sm:whitespace-nowrap sm:px-4">
      free shipping over $100 CAD — free 14-day returns
    </div>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const itemCount = useCart((s) => s.itemCount());
  const openCart = useCart((s) => s.openCart);
  const location = useLocation();
  const isHome = location.pathname === "/";
  const overlay = isHome && !scrolled;

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 48);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  function isActive(href: string) {
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <header
        className={cn(
          "z-50 transition-all duration-500",
          isHome
            ? overlay
              ? "fixed top-[max(1rem,env(safe-area-inset-top))] left-3 right-3 sm:top-8 sm:left-10 sm:right-10 lg:top-10 lg:left-14 lg:right-14"
              : "fixed top-0 left-0 right-0"
            : "sticky top-0",
          overlay
            ? "bg-transparent"
            : isHome
              ? "bg-white/70 backdrop-blur-xl border-b border-white/50 shadow-[0_8px_30px_rgba(17,26,34,0.06)]"
              : "bg-sand/95 backdrop-blur-sm border-b border-charcoal/10"
        )}
      >
        {isHome ? null : <AnnouncementBar />}
        <nav
          className={cn(
            overlay
              ? "px-3 sm:px-8 lg:px-10"
              : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
          )}
        >
          <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center lg:flex lg:h-18 lg:justify-between">
            <div className="flex items-center justify-start gap-4">
              <button
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full transition-colors sm:h-11 sm:w-11",
                  overlay ? "bg-gold text-charcoal" : "bg-navy text-white"
                )}
                onClick={() => setMobileOpen(true)}
                aria-expanded={mobileOpen}
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
              <div className="hidden lg:flex items-center gap-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    prefetch="intent"
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors",
                      overlay
                        ? "text-white/90 hover:text-white"
                        : isActive(link.href)
                          ? "text-navy"
                          : "text-charcoal hover:text-navy"
                    )}
                    aria-current={isActive(link.href) ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <Link
              to="/"
              prefetch="intent"
              aria-label="shiftshappn home"
              className="justify-self-center lg:absolute lg:left-1/2 lg:-translate-x-1/2"
            >
              <span className="relative flex h-9 w-10 items-center justify-center sm:h-12 sm:w-36 lg:w-47">
                <img
                  src="/images/logo.png"
                  alt=""
                  width={150}
                  height={176}
                  className={cn(
                    "absolute h-8 w-auto origin-center transition-all duration-300 ease-out motion-reduce:transition-none sm:h-11",
                    overlay && "drop-shadow-[0_6px_16px_rgba(0,0,0,0.35)]",
                    scrolled
                      ? "scale-100 opacity-100 sm:pointer-events-none sm:scale-90 sm:opacity-0"
                      : "scale-100 opacity-100"
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    "hidden font-sans text-xl font-extrabold uppercase tracking-tight transition-all duration-300 ease-out motion-reduce:transition-none sm:inline",
                    overlay ? "text-white" : "text-navy",
                    scrolled
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-1 opacity-0"
                  )}
                >
                  shiftshappn
                </span>
              </span>
            </Link>

            <div className="flex items-center justify-end gap-0.5 sm:gap-3">
              <Link
                to="/shop"
                prefetch="intent"
                className={cn(
                  "hidden min-h-11 min-w-11 items-center justify-center p-2.5 transition-colors sm:flex",
                  overlay ? "text-white hover:text-white/80" : "text-charcoal hover:text-navy"
                )}
                aria-label="Browse shop"
              >
                <Search size={20} />
              </Link>
              <Link
                to="/account"
                prefetch="intent"
                className={cn(
                  "flex h-10 w-10 items-center justify-center transition-colors sm:min-h-11 sm:min-w-11 sm:w-auto sm:p-2.5",
                  overlay ? "text-white hover:text-white/80" : "text-charcoal hover:text-navy"
                )}
                aria-label="Account"
              >
                <User size={20} />
              </Link>
              <button
                onClick={openCart}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center transition-colors sm:min-h-11 sm:min-w-11 sm:w-auto sm:p-2.5",
                  overlay ? "text-white hover:text-white/80" : "text-charcoal hover:text-navy"
                )}
                aria-label={`Cart, ${itemCount} items`}
              >
                <ShoppingBag size={20} />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-white">
                    {itemCount}
                  </span>
                )}
              </button>
              <Link
                to="/shop"
                prefetch="intent"
                className="hidden sm:inline-flex rounded-full bg-gold px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-charcoal transition-transform hover:scale-105"
              >
                Shop now
              </Link>
            </div>
          </div>

        </nav>
      </header>
      <FullscreenMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <CartDrawer />
    </>
  );
}

export function Footer() {
  return (
    <footer className="bg-navy text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link to="/about" prefetch="intent" className="hover:text-sky transition-colors">
              About
            </Link>
            <Link to="/size-chart" prefetch="intent" className="hover:text-sky transition-colors">
              Size chart
            </Link>
            <Link to="/faq" prefetch="intent" className="hover:text-sky transition-colors">
              FAQ
            </Link>
            <Link to="/contact" prefetch="intent" className="hover:text-sky transition-colors">
              Contact
            </Link>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a
              href="https://instagram.com/shiftshappn"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky transition-colors"
            >
              Instagram
            </a>
            <a
              href="https://tiktok.com/@shiftshappn"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky transition-colors"
            >
              TikTok
            </a>
          </div>
        </div>
        <p className="text-center text-xs text-white/50 mt-8">
          © {new Date().getFullYear()} shiftshappn. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
