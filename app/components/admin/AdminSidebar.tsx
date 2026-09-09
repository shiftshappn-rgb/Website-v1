import { useState } from "react";
import { Form, NavLink } from "react-router";
import { cn } from "~/lib/utils";

const navItems = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/colors", label: "Colours" },
  { to: "/admin/collections", label: "Collections" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/customers", label: "Customers" },
  { to: "/admin/blog", label: "Blog" },
  { to: "/admin/homepage-blocks", label: "Homepage" },
  { to: "/admin/discounts", label: "Discounts" },
  { to: "/admin/media", label: "Media" },
  { to: "/admin/reviews", label: "Reviews" },
  { to: "/admin/settings", label: "Settings" },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-lg bg-navy p-2 text-white lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? "✕" : "☰"}
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
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-5">
          {!collapsed && (
            <span className="font-serif text-lg text-sand">ShiftsHappn</span>
          )}
          <button
            type="button"
            className="hidden rounded p-1 text-white/70 hover:text-white lg:block"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              prefetch="intent"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-navy text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )
              }
            >
              {!collapsed && item.label}
              {collapsed && <span className="mx-auto text-xs">{item.label[0]}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-2">
          <Form method="post" action="/admin/logout">
            <button
              type="submit"
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-terracotta transition-colors hover:bg-white/10",
                collapsed && "justify-center"
              )}
            >
              {collapsed ? "↪" : "Logout"}
            </button>
          </Form>
        </div>
      </aside>
    </>
  );
}
