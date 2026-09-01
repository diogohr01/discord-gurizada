import { forwardRef, type HTMLAttributes } from "react";

export const AppScrollArea = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function AppScrollArea({ className, ...props }, ref) {
    return <div ref={ref} className={["nexus-scroll-area", className].filter(Boolean).join(" ")} {...props} />;
  },
);
