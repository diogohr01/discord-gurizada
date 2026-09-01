import type { AdminLogEntry, ServerConfiguration } from "@/types/realtime";

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload;
}

export async function getServerConfiguration(): Promise<ServerConfiguration> {
  return readJson<ServerConfiguration>(await fetch("/api/server/config", { cache: "no-store" }));
}

export async function getAdminState(): Promise<{ config: ServerConfiguration; logs: AdminLogEntry[] }> {
  return readJson(await fetch("/api/admin", { cache: "no-store" }));
}

export async function runAdminAction(body: Record<string, unknown>) {
  return readJson<{ ok: true; config?: ServerConfiguration }>(await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}
