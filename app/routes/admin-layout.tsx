import { Outlet, useNavigation } from "react-router";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { Route } from "./+types/admin-layout";
import { AdminSidebar } from "~/components/admin/AdminSidebar";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { NavigationProgress } from "~/components/NavigationProgress";
import { isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";
import { cn } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const, admin: null };
  }

  const { admin } = await requireAdmin(request);
  return { dbAvailable: true as const, admin: { email: admin.email, role: admin.role } };
}

export function shouldRevalidate({
  formAction,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formAction?.includes("/admin/logout") || formAction?.includes("/admin/login")) {
    return true;
  }
  if (formAction) {
    return defaultShouldRevalidate;
  }
  return false;
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";

  if (!loaderData.dbAvailable) {
    return (
      <div className="min-h-screen bg-sand">
        <DatabaseUnavailable />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-sand">
      <NavigationProgress />
      <AdminSidebar />
      <main
        className={cn(
          "flex-1 overflow-auto overflow-x-hidden transition-opacity duration-200",
          pending && "opacity-80"
        )}
      >
        <div className="p-4 pt-[max(4rem,calc(env(safe-area-inset-top)+3.5rem))] pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-8 lg:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
