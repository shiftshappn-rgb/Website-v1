import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "~/lib/utils";

export function PasswordField({
  label = "Password",
  name = "password",
  autoComplete = "current-password",
  helperText,
  minLength,
  required = true,
  className,
}: {
  label?: string;
  name?: string;
  autoComplete?: string;
  helperText?: string;
  minLength?: number;
  required?: boolean;
  className?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-charcoal">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className="w-full rounded-lg border border-charcoal/20 bg-white py-2.5 pl-4 pr-12 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center px-3 text-charcoal/50 transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-inset"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {helperText ? <p className="text-xs text-charcoal/50">{helperText}</p> : null}
    </div>
  );
}
