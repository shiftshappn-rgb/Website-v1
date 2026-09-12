import { Outlet, useNavigation } from "react-router";
import type { Route } from "./+types/storefront-layout";
import { NavigationProgress } from "~/components/NavigationProgress";
import { OfferBanner } from "~/components/storefront/OfferBanner";
import { Navbar, Footer } from "~/components/storefront/Navbar";
import { tryDb } from "~/db.server";
import { getActiveMonthlyOffer } from "~/lib/commerce.server";
import { cn } from "~/lib/utils";

export async function loader({}: Route.LoaderArgs) {
  const db = tryDb();
  if (!db) {
    return { offer: null };
  }

  try {
    const offer = await getActiveMonthlyOffer(db);
    return {
      offer: offer
        ? {
            title: offer.title,
            subtitle: offer.subtitle,
            ctaLabel: offer.ctaLabel,
            ctaHref: offer.ctaHref,
            discountCode: offer.discountCode,
          }
        : null,
    };
  } catch {
    return { offer: null };
  }
}

export default function StorefrontLayout({ loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";
  const offer = loaderData.offer;

  return (
    <div className="flex min-h-screen flex-col">
      <NavigationProgress />
      {offer && (
        <OfferBanner
          title={offer.title}
          subtitle={offer.subtitle}
          ctaLabel={offer.ctaLabel}
          ctaHref={offer.ctaHref}
          discountCode={offer.discountCode}
        />
      )}
      <Navbar />
      <main
        id="main-content"
        className={cn(
          "flex-1 transition-opacity duration-200",
          pending && "opacity-80"
        )}
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
