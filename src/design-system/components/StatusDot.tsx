export function StatusDot({ status = "online" }: { status?: "online" | "warning" | "danger" | "offline" }) {
  return <span className={`status-dot status-dot--${status}`} aria-label={status === "online" ? "online" : status} />;
}
