import { useNavigation } from "react-router";
import { cn } from "~/lib/utils";

export function NavigationProgress() {
  const navigation = useNavigation();
  const active = navigation.state !== "idle";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-200 h-0.5 overflow-hidden"
      role="status"
      aria-live="polite"
      aria-hidden={!active}
    >
      {active ? <span className="sr-only">Loading page</span> : null}
      <div
        className={cn(
          "h-full bg-gold",
          active ? "w-2/5 animate-nav-progress" : "w-0"
        )}
      />
    </div>
  );
}
