import { Link } from "react-router";

export function OfferBanner({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  discountCode,
}: {
  title: string;
  subtitle?: string | null;
  ctaLabel: string;
  ctaHref: string;
  discountCode?: string | null;
}) {
  return (
    <div className="bg-gold px-4 py-2.5 text-center text-sm text-charcoal">
      <p className="font-medium">
        {title}
        {subtitle ? ` — ${subtitle}` : ""}
        {discountCode ? ` · Code ${discountCode}` : ""}{" "}
        <Link to={ctaHref} className="underline underline-offset-4">
          {ctaLabel}
        </Link>
      </p>
    </div>
  );
}
