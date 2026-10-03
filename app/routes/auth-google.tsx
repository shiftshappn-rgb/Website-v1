import type { Route } from "./+types/auth-google";
import { startGoogleOAuth } from "~/lib/google-auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  return startGoogleOAuth(request);
}

export default function AuthGoogle() {
  return null;
}
