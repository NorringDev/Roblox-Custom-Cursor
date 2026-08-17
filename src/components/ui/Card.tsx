import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface-900/80 border border-surface-700/50 rounded-2xl p-5",
        "backdrop-blur-sm",
        hover &&
          "hover:border-surface-600 hover:bg-surface-800/80 transition-all duration-200 cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
