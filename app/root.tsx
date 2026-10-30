import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import { NotFoundPage } from "~/components/storefront/NotFoundPage";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
  },
];

export function meta(): Route.MetaDescriptors {
  return [
    { title: "shiftshappn — Premium Canadian Medical Scrubs" },
    {
      name: "description",
      content:
        "Soft, stretch scrubs with pockets that actually hold what you carry. Canadian made. Free Shift Drop in Halifax.",
    },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <main id="main-content">
        <NotFoundPage />
      </main>
    );
  }

  let message = "Something went wrong";
  let details = "An unexpected error occurred.";
  let status = 500;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    message = "Error";
    details = error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="max-w-md text-center">
        <p className="mb-4 font-serif text-6xl text-navy">{status}</p>
        <h1 className="mb-2 font-serif text-2xl text-charcoal">{message}</h1>
        <p className="mb-8 text-charcoal/70">{details}</p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-navy px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-navy/90"
        >
          Back to home
        </a>
      </div>
    </main>
  );
}
