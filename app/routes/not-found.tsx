import { data } from "react-router";
import type { Route } from "./+types/not-found";
import { NotFoundPage } from "~/components/storefront/NotFoundPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Page not found — shiftshappn" },
    { name: "robots", content: "noindex" },
  ];
}

export function loader({}: Route.LoaderArgs) {
  return data(null, { status: 404 });
}

export default function NotFound() {
  return <NotFoundPage />;
}
