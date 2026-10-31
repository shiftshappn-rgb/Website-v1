import { Link } from "react-router";
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-sand lg:grid lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <aside
        className="relative hidden overflow-hidden bg-navy text-gold lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-14 xl:px-16"
        aria-hidden
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_15%,rgba(201,165,90,0.18),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(-18deg,transparent,transparent_14px,rgba(247,244,238,0.9)_14px,rgba(247,244,238,0.9)_15px)]" />

        <div className="relative z-10">
          <Link
            to="/"
            className="inline-flex font-sans text-xl font-extrabold uppercase tracking-tight text-gold transition-opacity hover:opacity-90"
          >
            shiftshappn
          </Link>
        </div>

        <div className="relative z-10 max-w-md space-y-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold/55">
            Account
          </p>
          <h2 className="font-serif text-4xl leading-[1.15] tracking-tight text-gold xl:text-5xl">
            Scrubs made for the shift.
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-gold/70">
            Track orders, save addresses, and check out faster — built for people who live in
            scrubs.
          </p>
        </div>

        <p className="relative z-10 text-[11px] uppercase tracking-[0.18em] text-gold/40">
          Free size exchange within 30 days
        </p>
      </aside>

      <section className="relative flex flex-col justify-center px-4 py-12 sm:px-8 lg:px-12 xl:px-20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/70 via-sand/40 to-sand" />
        <div className="relative z-10 mx-auto w-full max-w-md">
          <Link
            to="/"
            className="mb-8 inline-flex font-sans text-lg font-extrabold uppercase tracking-tight text-navy lg:hidden"
          >
            shiftshappn
          </Link>

          <header className="mb-8 space-y-2">
            <h1 className="font-serif text-3xl tracking-tight text-navy sm:text-[2.15rem]">
              {title}
            </h1>
            <p className="text-sm leading-relaxed text-charcoal/65">{subtitle}</p>
          </header>

          <div
            className={cn(
              "rounded-2xl border border-charcoal/10 bg-white/90 p-5 shadow-[0_18px_40px_rgba(17,26,34,0.06)] backdrop-blur-sm sm:p-7"
            )}
          >
            {children}
          </div>

          {footer ? <div className="mt-6 text-center text-sm text-charcoal/55">{footer}</div> : null}
        </div>
      </section>
    </div>
  );
}

export function AuthDivider({ label = "or continue with email" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-charcoal/40">
      <div className="h-px flex-1 bg-charcoal/10" />
      <span>{label}</span>
      <div className="h-px flex-1 bg-charcoal/10" />
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {message}
    </div>
  );
}
