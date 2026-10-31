import { Link } from "react-router";
import { formatCurrency } from "~/lib/utils";

const FAN_THEMES = [
  "from-sky to-sky/80",
  "from-navy to-navy/85",
  "from-sky via-sky to-navy/70",
  "from-[#6eb5d8] to-sky",
  "from-navy via-sky/90 to-navy",
] as const;

/** Desktop fan spread; mobile uses a tighter set below. */
const FAN_ROTATIONS_DESKTOP = [-14, -7, 0, 7, 14] as const;
const FAN_ROTATIONS_MOBILE = [-10, 0, 10] as const;

function FanCard({
  amount,
  theme,
  rotation,
  index,
  href,
  size = "desktop",
}: {
  amount: number;
  theme: string;
  rotation: number;
  index: number;
  href: string;
  size?: "mobile" | "desktop";
}) {
  const isMobile = size === "mobile";

  return (
    <Link
      to={href}
      prefetch="intent"
      aria-label={`Shop ${formatCurrency(amount)} gift card`}
      className="group relative block shrink-0 transition-[transform,z-index] duration-300 hover:z-50 focus-visible:z-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
      style={{
        zIndex: index + 1,
        marginLeft: index === 0 ? 0 : isMobile ? "-2.35rem" : "clamp(-2.5rem, -8vw, -3.25rem)",
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <div
        className={
          isMobile
            ? "w-[5.75rem] overflow-hidden rounded-[1rem] shadow-[0_14px_32px_-12px_rgba(17,26,34,0.28)] transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:rotate-0"
            : "w-[7.5rem] overflow-hidden rounded-[1.1rem] shadow-[0_18px_40px_-12px_rgba(17,26,34,0.28)] transition-transform duration-300 group-hover:-translate-y-2 group-hover:rotate-0 sm:w-[9.5rem] sm:rounded-[1.25rem] lg:w-[11rem]"
        }
      >
        <div
          className={`relative aspect-3/4 bg-linear-to-br ${theme} px-3 py-4 text-white sm:px-4 sm:py-5`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_45%)]" />
          <div className="relative flex h-full flex-col items-center justify-between text-center">
            <p className="text-[7px] font-semibold uppercase tracking-[0.28em] text-white/75 sm:text-[9px]">
              E-gift
            </p>
            <div className="space-y-1.5 sm:space-y-2">
              <svg
                viewBox="0 0 72 52"
                className="mx-auto h-7 w-10 text-white/85 sm:h-9 sm:w-14"
                fill="none"
                aria-hidden
              >
                <rect
                  x="6"
                  y="16"
                  width="60"
                  height="32"
                  rx="5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                />
                <path d="M6 26h60" stroke="currentColor" strokeWidth="2.5" />
                <path
                  d="M36 16v-7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M28 9h16"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <p className="font-serif text-[11px] leading-none sm:text-base">
                A gift for you
              </p>
              <p className="text-base font-bold sm:text-xl">{formatCurrency(amount)}</p>
            </div>
            <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-white/80 sm:text-[9px]">
              ShiftsHappn
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function buildAmounts(amounts: number[], count: number) {
  if (amounts.length >= count) return amounts.slice(0, count);
  return [...amounts, 50, 75, 100, 150, 200].slice(0, count);
}

export function GiftCardFan({
  amounts,
  linkBase = "/gift-cards",
}: {
  amounts: number[];
  linkBase?: string;
}) {
  const desktopCards = buildAmounts(amounts, 5);
  // Prefer middle denominations on small screens so the fan stays readable.
  const mobileSource =
    amounts.length >= 3 ? amounts : desktopCards;
  const mobileMid = Math.floor(mobileSource.length / 2);
  const mobileCards =
    mobileSource.length <= 3
      ? mobileSource
      : mobileSource.slice(
          Math.max(0, mobileMid - 1),
          Math.max(0, mobileMid - 1) + 3
        );

  return (
    <div className="relative flex items-end justify-center py-2 sm:min-h-[22rem] sm:px-4 sm:py-4">
      {/* Mobile: 3-card fan that fits a phone width */}
      <div className="flex items-end justify-center px-1 sm:hidden">
        {mobileCards.map((amount, index) => (
          <FanCard
            key={`m-${amount}-${index}`}
            amount={amount}
            theme={FAN_THEMES[index % FAN_THEMES.length]}
            rotation={FAN_ROTATIONS_MOBILE[index % FAN_ROTATIONS_MOBILE.length]}
            index={index}
            size="mobile"
            href={`${linkBase}?amount=${amount}`}
          />
        ))}
      </div>

      {/* sm+: full 5-card fan */}
      <div className="relative hidden items-end justify-center sm:flex">
        {desktopCards.map((amount, index) => (
          <FanCard
            key={`d-${amount}-${index}`}
            amount={amount}
            theme={FAN_THEMES[index % FAN_THEMES.length]}
            rotation={FAN_ROTATIONS_DESKTOP[index % FAN_ROTATIONS_DESKTOP.length]}
            index={index}
            size="desktop"
            href={`${linkBase}?amount=${amount}`}
          />
        ))}
      </div>
    </div>
  );
}
