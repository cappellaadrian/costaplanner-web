import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none",
          variant === "primary" &&
            "bg-amber-500 text-zinc-950 hover:bg-amber-400",
          variant === "secondary" &&
            "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
          variant === "ghost" &&
            "text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100",
          variant === "danger" && "bg-red-600 text-white hover:bg-red-500",
          size === "sm" && "h-8 px-3 text-sm",
          size === "md" && "h-9 px-4 text-sm",
          size === "lg" && "h-12 px-6 text-base",
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
