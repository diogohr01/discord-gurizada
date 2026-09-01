import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/session-server";
import { createSupabaseDataClient } from "@/lib/supabase/server";
import type { ChatMessage, ChatTarget, ServerConfiguration } from "@/types/realtime";
import { getServerConfiguration } from "@/lib/server-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE_BUCKET = "chat-files";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MESSAGES_PER_QUERY = 500;

interface MessageRow {
  id: string;
  channel_id: string | null;
  dm_identity: string | null;
  author_identity: string;
  author_name: string;
  text: string;
  kind: "text" | "thread" | "poll" | "file";
  poll: { question: string; options: string[] } | null;
  file_name: string | null;
  file_mime_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  created_at: string;
}

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

function targetFromBody(targetType: unknown, targetId: unknown): ChatTarget | null {
  if ((targetType !== "channel" && targetType !== "dm") || typeof targetId !== "string" || !targetId.trim()) return null;
  return targetType === "channel" ? { type: "channel", channelId: targetId } : { type: "dm", identity: targetId, name: targetId };
}

function targetIsValid(target: ChatTarget, config: ServerConfiguration): boolean {
  return target.type === "channel"
    ? config.textChannels.some((channel) => channel.id === target.channelId)
    : /^[a-z0-9-]{1,32}_[0-9a-f-]{36}$/.test(target.identity);
}

async function signedUrl(path: string | null): Promise<string> {
  if (!path) return "";
  const { data } = await createSupabaseDataClient().storage.from(FILE_BUCKET).createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl || "";
}

async function toChatMessage(row: MessageRow, viewerIdentity: string): Promise<ChatMessage> {
  const fileUrl = await signedUrl(row.storage_path);
  const dmIdentity = row.dm_identity
    ? row.author_identity === viewerIdentity ? row.dm_identity : row.author_identity
    : undefined;
  return {
    id: row.id,
    channelId: row.channel_id || undefined,
    dmIdentity,
    identity: row.author_identity,
    author: row.author_name,
    text: row.text,
    timestamp: Date.parse(row.created_at),
    kind: row.kind,
    poll: row.poll || undefined,
    file: row.kind === "file" && row.file_name && row.file_mime_type && row.file_size !== null
      ? { name: row.file_name, mimeType: row.file_mime_type, size: row.file_size, url: fileUrl }
      : undefined,
  };
}

function uniqueRows(rows: MessageRow[]): MessageRow[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

async function authorizedSession() {
  const session = await getCurrentSession();
  return session;
}

export async function GET() {
  const session = await authorizedSession();
  if (!session) return failure(401, "SESSION_EXPIRED", "Sua sessão expirou. Entre novamente.");

  try {
    const client = createSupabaseDataClient();
    const select = "id, channel_id, dm_identity, author_identity, author_name, text, kind, poll, file_name, file_mime_type, file_size, storage_path, created_at";
    const [channels, sentDms, receivedDms] = await Promise.all([
      client.from("chat_messages").select(select).not("channel_id", "is", null).order("created_at", { ascending: false }).limit(MAX_MESSAGES_PER_QUERY),
      client.from("chat_messages").select(select).eq("author_identity", session.identity).not("dm_identity", "is", null).order("created_at", { ascending: false }).limit(MAX_MESSAGES_PER_QUERY),
      client.from("chat_messages").select(select).eq("dm_identity", session.identity).not("dm_identity", "is", null).order("created_at", { ascending: false }).limit(MAX_MESSAGES_PER_QUERY),
    ]);
    const result = [channels, sentDms, receivedDms].find((item) => item.error);
    if (result?.error) throw result.error;
    const rows = uniqueRows([
      ...(channels.data || []), ...(sentDms.data || []), ...(receivedDms.data || []),
    ] as MessageRow[]);
    const messages = await Promise.all(rows.map((row) => toChatMessage(row, session.identity)));
    return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Message history failed", cause);
    return failure(503, "DATABASE_UNAVAILABLE", "O histórico não está disponível.");
  }
}

export async function POST(request: Request) {
  const session = await authorizedSession();
  if (!session) return failure(401, "SESSION_EXPIRED", "Sua sessão expirou. Entre novamente.");

  let target: ChatTarget | null = null;
  try {
    const config = await getServerConfiguration();
    const formContent = request.headers.get("content-type")?.includes("multipart/form-data");
    if (formContent) {
      const form = await request.formData();
      target = targetFromBody(form.get("targetType"), form.get("targetId"));
      const file = form.get("file");
      if (!target || !targetIsValid(target, config) || target.type === "dm" && target.identity === session.identity) return failure(400, "INVALID_TARGET", "Destino de mensagem inválido.");
      if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_BYTES) return failure(400, "INVALID_FILE", "O arquivo deve ter entre 1 byte e 10 MB.");

      const safeName = file.name.trim().replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "arquivo";
      const path = `${session.identity}/${randomUUID()}-${safeName}`;
      const client = createSupabaseDataClient();
      const upload = await client.storage.from(FILE_BUCKET).upload(path, await file.arrayBuffer(), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upload.error) throw upload.error;

      const row = {
        id: randomUUID(),
        channel_id: target.type === "channel" ? target.channelId : null,
        dm_identity: target.type === "dm" ? target.identity : null,
        author_identity: session.identity,
        author_name: session.displayName,
        text: safeName,
        kind: "file" as const,
        poll: null,
        file_name: safeName,
        file_mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        storage_path: path,
      };
      const inserted = await client.from("chat_messages").insert(row).select("*").single();
      if (inserted.error) {
        await client.storage.from(FILE_BUCKET).remove([path]);
        throw inserted.error;
      }
      return NextResponse.json(await toChatMessage(inserted.data as MessageRow, session.identity));
    }

    const body = await request.json() as Record<string, unknown>;
    target = targetFromBody(body.targetType, body.targetId);
    if (!target || !targetIsValid(target, config) || target.type === "dm" && target.identity === session.identity) return failure(400, "INVALID_TARGET", "Destino de mensagem inválido.");
    const kind = body.kind === "thread" || body.kind === "poll" ? body.kind : "text";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 2000) return failure(400, "INVALID_MESSAGE", "A mensagem deve ter entre 1 e 2000 caracteres.");
    const poll = kind === "poll" && typeof body.poll === "object" && body.poll !== null
      ? body.poll as { question?: unknown; options?: unknown }
      : null;
    const normalizedPoll = poll && typeof poll.question === "string" && Array.isArray(poll.options)
      ? { question: poll.question.trim(), options: poll.options.filter((option): option is string => typeof option === "string").map((option) => option.trim()).filter(Boolean).slice(0, 5) }
      : null;
    if (kind === "poll" && (!normalizedPoll || normalizedPoll.question.length === 0 || normalizedPoll.question.length > 160 || normalizedPoll.options.length < 2)) return failure(400, "INVALID_POLL", "A enquete precisa de uma pergunta e pelo menos duas opções.");

    const inserted = await createSupabaseDataClient().from("chat_messages").insert({
      id: randomUUID(),
      channel_id: target.type === "channel" ? target.channelId : null,
      dm_identity: target.type === "dm" ? target.identity : null,
      author_identity: session.identity,
      author_name: session.displayName,
      text: kind === "poll" ? normalizedPoll?.question || text : text,
      kind,
      poll: normalizedPoll,
      file_name: null,
      file_mime_type: null,
      file_size: null,
      storage_path: null,
    }).select("*").single();
    if (inserted.error) throw inserted.error;
    return NextResponse.json(await toChatMessage(inserted.data as MessageRow, session.identity));
  } catch (cause) {
    console.error("Message write failed", cause);
    return failure(503, "DATABASE_UNAVAILABLE", "Não foi possível guardar a mensagem.");
  }
}
