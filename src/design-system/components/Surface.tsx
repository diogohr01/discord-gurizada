import type { HTMLAttributes } from "react";

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={["nexus-surface", className].filter(Boolean).join(" ")} {...props} />;
}
