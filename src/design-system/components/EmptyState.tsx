import type { ReactNode } from "react";

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="nexus-empty-state">
      {icon && <div className="nexus-empty-state__icon">{icon}</div>}
      <strong>{title}</strong>
      {description && <span>{description}</span>}
    </div>
  );
}
