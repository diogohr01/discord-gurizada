import type {
  ApiError,
  TokenRequest,
  TokenSuccess,
} from "@/types/realtime";

export class RealtimeTokenError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "RealtimeTokenError";
  }
}

export async function getRealtimeToken(request: TokenRequest): Promise<TokenSuccess> {
  const response = await fetch("/api/livekit/token", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const payload = (await response.json()) as TokenSuccess | ApiError;
  if (!response.ok) {
    const failure = payload as ApiError;
    throw new RealtimeTokenError(
      failure.message || "Não foi possível conectar.",
      failure.code || "UNKNOWN",
      response.status,
    );
  }
  return payload as TokenSuccess;
}

export async function restoreRealtimeToken(): Promise<TokenSuccess> {
  return getRealtimeToken({ action: "restore" });
}

export async function clearRealtimeSession(): Promise<void> {
  try {
    await fetch("/api/livekit/token", {
      method: "DELETE",
      credentials: "same-origin",
    });
  } catch {
    // The following authentication request will still be authoritative.
  }
}
