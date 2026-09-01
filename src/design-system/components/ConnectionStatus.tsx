import type { NexusConnectionState } from "@/types/realtime";

const labels: Record<NexusConnectionState, string> = {
  offline: "Sem conexão",
  connecting: "Conectando",
  connected: "Conectado",
  reconnecting: "Reconectando",
};

export function ConnectionStatus({ state, latencyMs }: { state: NexusConnectionState; latencyMs?: number | null }) {
  const latencyLabel = latencyMs === undefined ? null : latencyMs === null ? "— ms" : `${latencyMs} ms`;
  const latencyTone = latencyMs === null || latencyMs === undefined ? "unknown" : latencyMs >= 300 ? "bad" : latencyMs >= 150 ? "warn" : "good";
  return (
    <span className={`connection-status connection-status--${state}`} role="status">
      <span aria-hidden className="connection-status__dot" />
      {labels[state]}
      {latencyLabel && <span className={`connection-status__latency connection-status__latency--${latencyTone}`} title="Latência entre este navegador e o servidor">{latencyLabel}</span>}
    </span>
  );
}
