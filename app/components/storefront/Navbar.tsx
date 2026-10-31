import { Link, useLocation } from "react-router";
import { ShoppingBag, Search, User, Menu } from "lucide-react";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { useCart } from "~/lib/cart";
import { cn } from "~/lib/utils";

const CartDrawer = lazy(() =>
  import("~/components/storefront/CartDrawer").then((m) => ({ default: m.CartDrawer }))
);
const FullscreenMenu = lazy(() =>
  import("~/components/storefront/FullscreenMenu").then((m) => ({
    default: m.FullscreenMenu,
  }))
);
const SearchDrawer = lazy(() =>
  import("~/components/storefront/SearchDrawer").then((m) => ({
    default: m.SearchDrawer,
  }))
);

const navLinks = [
  { label: "Women", href: "/shop/women" },
  { label: "Men", href: "/shop/men" },
  { label: "Sets", href: "/shop" },
  { label: "Bundles", href: "/shop/bundles" },
  { label: "Accessories", href: "/shop/accessories" },
];

type NavCustomer = {
  id: string;
  name: string | null;
  email: string;
} | null;

export function AnnouncementBar() {
  return (
    <div className="bg-navy px-2 py-2 text-center text-xs leading-snug tracking-wide text-white sm:whitespace-nowrap sm:px-4">
      free Shift Drop in Halifax — free size exchange within 30 days
    </div>
  );
}

function AccountMenu({
  overlay,
  customer,
}: {
  overlay: boolean;
  customer: NavCustomer;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openMenu() {
    clearCloseTimer();
    setOpen(true);
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => clearCloseTimer(), []);

  const iconClass = cn(
    "flex h-10 w-10 items-center justify-center transition-colors sm:min-h-11 sm:min-w-11 sm:w-auto sm:p-2.5",
    overlay ? "text-white hover:text-white/80" : "text-charcoal hover:text-navy",
    open && (overlay ? "text-white" : "text-navy")
  );

  const linkClass =
    "block px-4 py-2.5 text-sm text-charcoal transition-colors hover:bg-sand hover:text-navy focus-visible:bg-sand focus-visible:outline-none";

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={iconClass}
        aria-label={customer ? "Account menu" : "Sign in menu"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        onFocus={openMenu}
      >
        <User size={20} />
      </button>

      <div
        id={menuId}
        role="menu"
        aria-label={customer ? "Account" : "Sign in"}
        className={cn(
          "absolute right-0 top-full z-50 mt-1 min-w-[11.5rem] origin-top-right rounded-xl border border-charcoal/10 bg-white py-1.5 shadow-[0_12px_28px_rgba(17,26,34,0.12)] transition-all duration-150",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0"
        )}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        {customer ? (
          <>
            <p className="truncate px-4 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-charcoal/45">
              {customer.name?.trim() || customer.email}
            </p>
            <Link
              to="/account"
              role="menuitem"
              prefetch="intent"
              className={linkClass}
              onClick={() => setOpen(false)}
            >
              My account
            </Link>
            <Link
              to="/account/orders"
              role="menuitem"
              prefetch="intent"
              className={linkClass}
              onClick={() => setOpen(false)}
            >
              Orders
            </Link>
            <div className="my-1.5 border-t border-charcoal/10" />
            <Link
              to="/auth/logout"
              role="menuitem"
              className={cn(linkClass, "text-terracotta hover:text-terracotta")}
              onClick={() => setOpen(false)}
            >
              Log out
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/auth/login"
              role="menuitem"
              prefetch="intent"
              className={linkClass}
              onClick={() => setOpen(false)}
            >
              Log in
            </Link>
            <Link
              to="/auth/register"
              role="menuitem"
              prefetch="intent"
              className={cn(linkClass, "font-medium text-navy")}
              onClick={() => setOpen(false)}
            >
              Create account
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export function Navbar({
  cloudName = null,
  customer = null,
}: {
  cloudName?: string | null;
  customer?: NavCustomer;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [searchMounted, setSearchMounted] = useState(false);
  const [cartMounted, setCartMounted] = useState(false);

  const rawItemCount = useCart((s) => s.itemCount());
  const itemCount = isHydrated ? rawItemCount : 0;
  const openCart = useCart((s) => s.openCart);
  const cartOpen = useCart((s) => s.isOpen);
  const location = useLocation();
  const isHome = location.pathname === "/";
  const overlay = isHome && !scrolled;

  useEffect(() => {
    setIsHydrated(true);
    function onScroll() {
      setScrolled(window.scrollY > 48);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileOpen) setMenuMounted(true);
  }, [mobileOpen]);
  useEffect(() => {
    if (searchOpen) setSearchMounted(true);
  }, [searchOpen]);
  useEffect(() => {
    if (cartOpen) setCartMounted(true);
  }, [cartOpen]);

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
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center transition-colors sm:min-h-11 sm:min-w-11 sm:w-auto sm:p-2.5",
                  overlay ? "text-white hover:text-white/80" : "text-charcoal hover:text-navy"
                )}
                aria-label="Search"
                aria-expanded={searchOpen}
                aria-haspopup="dialog"
              >
                <Search size={20} />
              </button>
              <AccountMenu overlay={overlay} customer={customer} />
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
      <Suspense fallback={null}>
        {menuMounted ? (
          <FullscreenMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
        ) : null}
        {searchMounted ? (
          <SearchDrawer
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            cloudName={cloudName}
          />
        ) : null}
        {cartMounted ? <CartDrawer cloudName={cloudName} /> : null}
      </Suspense>
    </>
  );
}

