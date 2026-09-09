import { Outlet, useNavigation } from "react-router";
import { NavigationProgress } from "~/components/NavigationProgress";
import { Navbar, Footer } from "~/components/storefront/Navbar";
import { cn } from "~/lib/utils";

export default function StorefrontLayout() {
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";

  return (
    <div className="min-h-screen flex flex-col">
      <NavigationProgress />
      <Navbar />
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
