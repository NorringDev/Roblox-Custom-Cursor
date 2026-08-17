import type { ReactNode } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-100">{title}</h1>
        {subtitle && (
          <p className="text-sm text-surface-500 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
