import { cn } from "../../lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error";
}

const badgeColors = {
  default: "bg-surface-800 text-surface-300 border-surface-600",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        badgeColors[variant]
      )}
    >
      {children}
    </span>
  );
}
