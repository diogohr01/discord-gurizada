import type { ChatMessage, ChatTarget } from "@/types/realtime";

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload;
}

export async function getPersistedMessages(): Promise<ChatMessage[]> {
  const payload = await readJson<{ messages: ChatMessage[] }>(await fetch("/api/messages", { cache: "no-store" }));
  return payload.messages;
}

export async function persistMessage(target: ChatTarget, text: string, kind: "text" | "thread" | "poll", poll?: { question: string; options: string[] }): Promise<ChatMessage> {
  return readJson<ChatMessage>(await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetType: target.type,
      targetId: target.type === "channel" ? target.channelId : target.identity,
      text,
      kind,
      poll,
    }),
  }));
}

export async function persistFile(target: ChatTarget, file: File): Promise<ChatMessage> {
  const form = new FormData();
  form.set("targetType", target.type);
  form.set("targetId", target.type === "channel" ? target.channelId : target.identity);
  form.set("file", file);
  return readJson<ChatMessage>(await fetch("/api/messages", { method: "POST", body: form }));
}

