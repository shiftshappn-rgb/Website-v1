import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
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
        "Soft, stretch scrubs with pockets that actually hold what you carry. Canadian made. Free shipping over $100 CAD.",
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
  let message = "Something went wrong";
  let details = "An unexpected error occurred.";
  let status = 500;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    message = error.status === 404 ? "Page not found" : "Error";
    details =
      error.status === 404
        ? "The page you're looking for doesn't exist."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }

  return (
    <main className="min-h-screen bg-sand flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-serif text-navy mb-4">{status}</p>
        <h1 className="text-2xl font-serif text-charcoal mb-2">{message}</h1>
        <p className="text-charcoal/70 mb-8">{details}</p>
        <a
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 bg-navy text-white rounded-full text-sm font-medium hover:bg-navy/90 transition-colors"
        >
          Back to home
        </a>
      </div>
    </main>
  );
}
