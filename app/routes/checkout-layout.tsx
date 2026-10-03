import { Outlet, Link, useLocation } from "react-router";
import { CheckoutProvider, useCheckout } from "~/lib/checkout-context";
import { cn } from "~/lib/utils";

const STEPS = [
  { number: 1, label: "Cart & Account", href: "/checkout", short: "Cart" },
  { number: 2, label: "Delivery", href: "/checkout/shipping", short: "Delivery" },
  { number: 3, label: "Payment", href: "/checkout/payment", short: "Payment" },
] as const;

function Stepper() {
  const location = useLocation();
  const { formData } = useCheckout();

  const currentStep =
    location.pathname.startsWith("/checkout/payment") ? 3
    : location.pathname.startsWith("/checkout/shipping") ? 2
    : 1;

  return (
    <nav aria-label="Checkout progress" className="mb-10">
      <ol className="flex items-center" role="list">
        {STEPS.map((step, index) => {
          const isActive = step.number === currentStep;
          const isComplete = step.number < currentStep;
          const isAccessible =
            step.number === 1 ||
            (step.number === 2 && !!formData.phase1) ||
            (step.number === 3 && !!formData.phase1 && !!formData.phase2);

          return (
            <li key={step.number} className="flex flex-1 items-center">
              <Link
                to={isAccessible ? step.href : "#"}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "group flex flex-col items-center gap-2 transition-opacity",
                  !isAccessible && "pointer-events-none opacity-40"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-sm font-semibold ring-2 ring-offset-2 transition-all duration-300",
                    isComplete
                      ? "bg-emerald-600 ring-emerald-600 text-white"
                      : isActive
                      ? "bg-[#1b2a4a] ring-[#1b2a4a] text-white scale-110"
                      : "bg-white ring-[#d1ccc3] text-[#888] ring-offset-[#f7f4ef]"
                  )}
                >
                  {isComplete ? (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </span>
                <span
                  className={cn(
                    "hidden sm:block text-xs font-medium tracking-wide uppercase",
                    isActive ? "text-[#1b2a4a]" : isComplete ? "text-emerald-600" : "text-[#aaa]"
                  )}
                >
                  {step.short}
                </span>
              </Link>

              {index < STEPS.length - 1 && (
                <div className="flex-1 mx-3">
                  <div
                    className={cn(
                      "h-px transition-all duration-500",
                      isComplete ? "bg-emerald-500" : "bg-[#ddd]"
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function CheckoutLayout() {
  return (
    <CheckoutProvider>
      <div className="min-h-screen bg-[#f7f4ef]">
        {/* Header bar */}
        <header className="border-b border-[#e5e0d8] bg-white/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link to="/" className="font-serif text-xl font-semibold text-[#1b2a4a] tracking-tight">
              shiftshappn
            </Link>
            <div className="flex items-center gap-2 text-xs text-[#888]">
              <svg className="size-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Secure Checkout
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <Stepper />
          <Outlet />
        </main>

        <footer className="border-t border-[#e5e0d8] mt-16 py-6">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-center gap-6 text-xs text-[#aaa]">
            <span>© {new Date().getFullYear()} shiftshappn</span>
            <Link to="/policies/privacy" className="hover:text-[#555]">Privacy</Link>
            <Link to="/policies/terms" className="hover:text-[#555]">Terms</Link>
            <Link to="/policies/returns" className="hover:text-[#555]">Returns</Link>
          </div>
        </footer>
      </div>
    </CheckoutProvider>
  );
}