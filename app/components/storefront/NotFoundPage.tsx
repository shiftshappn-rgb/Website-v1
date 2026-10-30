import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-white px-6 py-20 text-center sm:min-h-[75vh] sm:py-28">
      <p
        className="font-sans text-[clamp(3.5rem,12vw,6.5rem)] font-semibold leading-none tracking-tight text-charcoal/25"
        aria-hidden
      >
        404
      </p>
      <h1 className="mt-5 max-w-xl font-sans text-[clamp(1.5rem,4.5vw,2.25rem)] font-semibold leading-tight tracking-tight text-charcoal">
        The page you&apos;re looking for
        <br className="hidden sm:block" /> cannot be found
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-charcoal/55 sm:text-base">
        We&apos;re sorry for the inconvenience. Head back to shopping below.
      </p>
      <div className="mt-10 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
        <Link
          to="/shop/women"
          prefetch="intent"
          className="inline-flex h-12 items-center justify-center rounded-full bg-charcoal px-8 text-sm font-semibold text-white transition-colors hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Shop Women
        </Link>
        <Link
          to="/shop/men"
          prefetch="intent"
          className="inline-flex h-12 items-center justify-center rounded-full bg-charcoal px-8 text-sm font-semibold text-white transition-colors hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Shop Men
        </Link>
      </div>
    </div>
  );
}
