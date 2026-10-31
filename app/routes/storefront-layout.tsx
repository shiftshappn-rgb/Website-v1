import { isRouteErrorResponse, Outlet, useNavigation } from "react-router";
import type { Route } from "./+types/storefront-layout";
import { NavigationProgress } from "~/components/NavigationProgress";
import { NotFoundPage } from "~/components/storefront/NotFoundPage";
import { OfferBanner } from "~/components/storefront/OfferBanner";
import { Footer } from "~/components/storefront/Footer";
import { Navbar } from "~/components/storefront/Navbar";
import { tryDb } from "~/db.server";
import { getActiveMonthlyOffer } from "~/lib/commerce.server";
import { getCustomerNav } from "~/lib/session.server";
import { cn } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? null;
  const db = tryDb();

  const [customer, offer] = await Promise.all([
    getCustomerNav(request).catch(() => null),
    db
      ? getActiveMonthlyOffer(db).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    cloudName,
    customer: customer
      ? { id: customer.id, name: customer.name, email: customer.email }
      : null,
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
      <Navbar cloudName={loaderData.cloudName} customer={loaderData.customer} />
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

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main id="main-content" className="flex-1">
          <NotFoundPage />
        </main>
        <Footer />
      </div>
    );
  }

  throw error;
}
