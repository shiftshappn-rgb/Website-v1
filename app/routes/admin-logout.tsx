import { Form } from "react-router";
import type { Route } from "./+types/admin-logout";
import { Button } from "~/components/ui/Button";
import { destroyAdminSession } from "~/lib/session.server";

export async function action({ request }: Route.ActionArgs) {
  return destroyAdminSession(request);
}

export default function AdminLogout() {
  return (
    <div className="mx-auto max-w-md pt-12 text-center">
      <h1 className="mb-4 font-serif text-xl text-navy">Sign Out</h1>
      <Form method="post">
        <Button type="submit" variant="terracotta">
          Confirm Logout
        </Button>
      </Form>
    </div>
  );
}
