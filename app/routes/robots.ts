import type { Route } from "./+types/robots";

const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

export async function loader({}: Route.LoaderArgs) {
  const body = `User-agent: *
Disallow: /admin
Disallow: /account
Disallow: /api/

Sitemap: ${APP_URL}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
