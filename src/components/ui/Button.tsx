import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const variantStyles = {
  primary:
    "bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20 active:bg-brand-700",
  secondary:
    "bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-600 active:bg-surface-600",
  ghost:
    "bg-transparent hover:bg-surface-800 text-surface-400 hover:text-surface-200",
  danger:
    "bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/30 hover:border-red-600/50",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-xl",
  lg: "px-6 py-3 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 cursor-pointer select-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
