import type { Route } from "./+types/auth-google-callback";
import { completeGoogleOAuth } from "~/lib/google-auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  return completeGoogleOAuth(request);
}

export default function AuthGoogleCallback() {
  return null;
}
