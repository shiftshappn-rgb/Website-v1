import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

const shopLinks = [
  { label: "Women", href: "/shop/women" },
  { label: "Men", href: "/shop/men" },
  { label: "Sets", href: "/shop" },
  { label: "Bundles", href: "/shop/bundles" },
  { label: "Accessories", href: "/shop/accessories" },
  { label: "Shop by colour", href: "/shop/colour" },
  { label: "Shop by fabric", href: "/shop/fabric" },
  { label: "Gift cards", href: "/gift-cards" },
];

const helpLinks = [
  { label: "FAQ", href: "/faq" },
  { label: "Size chart", href: "/size-chart" },
  { label: "Contact", href: "/contact" },
  { label: "Delivery", href: "/policies/shipping" },
  { label: "Returns & exchanges", href: "/policies/returns" },
];

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Community", href: "/community" },
  { label: "ShiftKnit fabric", href: "/shiftknit" },
  { label: "Journal", href: "/blog" },
];

const policyLinks = [
  { label: "Privacy", href: "/policies/privacy" },
  { label: "Delivery", href: "/policies/shipping" },
  { label: "Returns & exchanges", href: "/policies/returns" },
];

const linkColumns = [
  { title: "Shop", links: shopLinks },
  { title: "Help", links: helpLinks },
  { title: "Company", links: companyLinks },
  { title: "Policies", links: policyLinks },
] as const;

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.18 8.18 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15Z" />
    </svg>
  );
}

function FooterLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      to={href}
      prefetch="intent"
      className="text-sm text-white/70 transition-colors hover:text-gold"
    >
      {children}
    </Link>
  );
}

function NewsletterSignup() {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "done">("idle");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setStatus("done");
    setEmail("");
  }

  return (
    <div className="max-w-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
        Stay in the loop
      </p>
      <h2 className="mt-3 font-serif text-3xl tracking-tight text-white sm:text-[2.1rem]">
        New drops, fit notes, Shift Drop dates.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-white/65">
        Soft scrubs updates for Halifax nurses — no spam, unsubscribe anytime.
      </p>

      {status === "done" ? (
        <p
          className="mt-6 rounded-2xl border border-gold/35 bg-white/5 px-4 py-3 text-sm text-gold"
          role="status"
        >
          Thanks — you’re on the list. We’ll be in touch soon.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6">
          <label htmlFor={inputId} className="sr-only">
            Email address
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              id={inputId}
              type="email"
              name="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              className="min-h-12 flex-1 rounded-full border border-white/20 bg-white/95 px-5 text-sm text-charcoal outline-none placeholder:text-charcoal/40 focus:border-gold focus:ring-2 focus:ring-gold/40"
            />
            <button
              type="submit"
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-gold px-6 text-[11px] font-extrabold uppercase tracking-[0.16em] text-charcoal transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Sign up
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function LinkColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/10 md:border-none">
      <button
        type="button"
        className="flex w-full items-center justify-between py-4 text-left md:pointer-events-none md:cursor-default md:py-0"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-white/60 transition-transform md:hidden",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      <ul
        id={panelId}
        className={cn(
          "space-y-3 overflow-hidden pb-4 md:block md:pb-0",
          open ? "block" : "hidden md:block"
        )}
      >
        {links.map((link) => (
          <li key={link.href + link.label}>
            <FooterLink href={link.href}>{link.label}</FooterLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto overflow-hidden bg-navy text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 18%, #c9a55a 0%, transparent 42%), radial-gradient(circle at 88% 8%, #5ca8d6 0%, transparent 36%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 border-b border-white/10 py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 lg:py-16">
          <div>
            <Link
              to="/"
              prefetch="intent"
              className="inline-flex items-baseline gap-1 font-sans text-2xl font-extrabold uppercase tracking-tight text-white"
            >
              shifts
              <span className="text-gold">happn</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
              Premium Canadian medical scrubs — soft stretch, real pockets, free Shift
              Drop in Halifax.
            </p>
            <div className="mt-8">
              <NewsletterSignup />
            </div>
          </div>

          <nav
            aria-label="Footer"
            className="grid gap-0 sm:grid-cols-2 sm:gap-x-10 md:grid-cols-4 md:gap-8 md:pt-1"
          >
            {linkColumns.map((column) => (
              <LinkColumn key={column.title} title={column.title} links={column.links} />
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <a
              href="https://instagram.com/shiftshappn"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:border-gold/50 hover:text-gold"
            >
              <InstagramIcon className="h-4 w-4" />
            </a>
            <a
              href="https://tiktok.com/@shiftshappn"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:border-gold/50 hover:text-gold"
            >
              <TikTokIcon className="h-4 w-4" />
            </a>
          </div>

          <p className="text-xs leading-relaxed text-white/45 sm:text-right">
            Soft stretch. Real pockets. Built for the floor.
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} shiftshappn. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/policies/privacy" prefetch="intent" className="hover:text-gold">
              Privacy
            </Link>
            <Link to="/policies/shipping" prefetch="intent" className="hover:text-gold">
              Delivery
            </Link>
            <Link to="/policies/returns" prefetch="intent" className="hover:text-gold">
              Returns
            </Link>
            <span>Halifax, NS · Canada</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
