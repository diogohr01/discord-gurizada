import type { NexusConnectionState } from "@/types/realtime";

const labels: Record<NexusConnectionState, string> = {
  offline: "Sem conexão",
  connecting: "Conectando",
  connected: "Conectado",
  reconnecting: "Reconectando",
};

export function ConnectionStatus({ state }: { state: NexusConnectionState }) {
  return (
    <span className={`connection-status connection-status--${state}`} role="status">
      <span aria-hidden className="connection-status__dot" />
      {labels[state]}
    </span>
  );
}
