import { Link } from "react-router";
import { cn } from "~/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "terracotta";
  size?: "sm" | "md" | "lg";
};

const variants = {
  primary: "bg-navy text-white hover:bg-navy/90",
  secondary: "bg-sky text-white hover:bg-sky/90",
  terracotta: "bg-terracotta text-white hover:bg-terracotta/90",
  outline: "border border-navy text-navy hover:bg-navy hover:text-white",
  ghost: "text-navy hover:bg-sand",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-3.5 text-base",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export function LinkButton({
  className,
  variant = "primary",
  size = "md",
  href,
  children,
}: {
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  href: string;
  children: React.ReactNode;
}) {
  const classes = cn(
    "inline-flex items-center justify-center font-medium rounded-full transition-colors",
    variants[variant ?? "primary"],
    sizes[size ?? "md"],
    className
  );

  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link to={href} prefetch="intent" className={classes}>
      {children}
    </Link>
  );
}
