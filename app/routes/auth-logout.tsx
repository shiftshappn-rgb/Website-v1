import type { Route } from "./+types/auth-logout";
import { destroyCustomerSession } from "~/lib/session.server";

export async function action({ request }: Route.ActionArgs) {
  return destroyCustomerSession(request);
}

export async function loader({ request }: Route.LoaderArgs) {
  return destroyCustomerSession(request);
}
