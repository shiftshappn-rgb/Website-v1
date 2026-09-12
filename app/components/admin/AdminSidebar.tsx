import { useEffect, useState } from "react";
import { Form, NavLink } from "react-router";
import {
  Award,
  BadgePercent,
  Folders,
  Gift,
  Image,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Newspaper,
  Package,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  Settings,
  ShoppingBag,
  Star,
  TicketPercent,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";

const navItems: Array<{
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}> = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: Folders },
  { to: "/admin/colors", label: "Colours", icon: Palette },
  { to: "/admin/collections", label: "Collections", icon: Layers },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/blog", label: "Blog", icon: Newspaper },
  { to: "/admin/homepage-blocks", label: "Homepage", icon: PanelTop },
  { to: "/admin/discounts", label: "Discounts", icon: TicketPercent },
  { to: "/admin/offers", label: "Offers", icon: BadgePercent },
  { to: "/admin/gift-cards", label: "Gift cards", icon: Gift },
  { to: "/admin/loyalty", label: "Loyalty", icon: Award },
  { to: "/admin/community", label: "Community", icon: MessagesSquare },
  { to: "/admin/media", label: "Media", icon: Image },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  return (
    <>
      <button
        type="button"
        className={cn(
          "fixed z-50 flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-navy text-white lg:hidden",
          mobileOpen
            ? "top-4 right-4 left-auto"
            : "top-[max(1rem,env(safe-area-inset-top))] left-4"
        )}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
      >
        {mobileOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-charcoal/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-charcoal text-white transition-all duration-300 lg:static lg:translate-x-0",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div
          className={cn(
            "flex items-center border-b border-white/10 px-4 py-5",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          {!collapsed && (
            <span className="font-serif text-lg text-sand">ShiftsHappn</span>
          )}
          <button
            type="button"
            className="hidden min-h-11 min-w-11 items-center justify-center rounded p-1 text-white/70 hover:text-white lg:flex"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} aria-hidden />
            ) : (
              <PanelLeftClose size={18} aria-hidden />
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                prefetch="intent"
                title={item.label}
                aria-label={item.label}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    collapsed ? "justify-center" : "gap-3",
                    isActive
                      ? "bg-navy text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )
                }
              >
                <Icon size={18} aria-hidden />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-2">
          <Form method="post" action="/admin/logout">
            <button
              type="submit"
              title="Logout"
              aria-label="Logout"
              className={cn(
                "flex min-h-11 w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-terracotta transition-colors hover:bg-white/10",
                collapsed ? "justify-center" : "gap-3"
              )}
            >
              <LogOut size={18} aria-hidden />
              {!collapsed && <span>Logout</span>}
            </button>
          </Form>
        </div>
      </aside>
    </>
  );
}
