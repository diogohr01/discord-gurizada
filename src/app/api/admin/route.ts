import { TrackSource } from "@livekit/protocol";
import { RoomServiceClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";

import { roomNames } from "@/config/app";
import { addAdminLog, addServerChannel, getAdminLogs, getServerConfiguration, isConfiguredVoiceChannel } from "@/lib/server-state";
import { getCurrentSession } from "@/lib/session-server";
import type { ApiError } from "@/types/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(status: number, code: string, message: string) {
  return NextResponse.json<ApiError>({ code, message }, { status });
}

async function adminSession() {
  const session = await getCurrentSession();
  return session?.role === "admin" ? session : null;
}

function roomService() {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) throw new Error("LIVEKIT_NOT_CONFIGURED");
  return new RoomServiceClient(url.replace(/^wss:/, "https:").replace(/^ws:/, "http:"), key, secret);
}

export async function GET() {
  const admin = await adminSession();
  if (!admin) return failure(403, "FORBIDDEN", "Acesso administrativo necessário.");
  try {
    return NextResponse.json({ config: await getServerConfiguration(), logs: await getAdminLogs() });
  } catch (cause) {
    console.error("Admin state failed", cause);
    return failure(503, "DATABASE_UNAVAILABLE", "O banco de dados não está disponível.");
  }
}

export async function POST(request: Request) {
  const admin = await adminSession();
  if (!admin) return failure(403, "FORBIDDEN", "Acesso administrativo necessário.");

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return failure(400, "INVALID_REQUEST", "Solicitação inválida."); }

  try {
    if (body.action === "createChannel" && (body.kind === "text" || body.kind === "voice") && typeof body.name === "string") {
      const channel = await addServerChannel(body.kind, body.name);
      await addAdminLog(admin.displayName, "Canal criado", `${body.kind === "text" ? "Texto" : "Voz"}: ${channel.name}`);
      return NextResponse.json({ ok: true, channel, config: await getServerConfiguration() });
    }

    if (body.action === "mute" && typeof body.identity === "string" && typeof body.channelId === "string" && typeof body.muted === "boolean") {
      if (!(await isConfiguredVoiceChannel(body.channelId))) return failure(400, "INVALID_CHANNEL", "Canal inválido.");
      const service = roomService();
      const room = roomNames.voice(body.channelId);
      const participant = await service.getParticipant(room, body.identity);
      const microphone = participant.tracks.find((track) => track.source === TrackSource.MICROPHONE);
      if (!microphone) return failure(409, "NO_MICROPHONE", "O usuário não publicou um microfone.");
      await service.mutePublishedTrack(room, body.identity, microphone.sid, body.muted);
      await service.updateParticipant(roomNames.lobby, body.identity, { attributes: { microphoneMuted: String(body.muted) } });
      await addAdminLog(admin.displayName, body.muted ? "Microfone moderado" : "Microfone liberado", participant.name || body.identity);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "move" && typeof body.identity === "string" && typeof body.fromChannelId === "string" && typeof body.toChannelId === "string") {
      if (!(await isConfiguredVoiceChannel(body.fromChannelId)) || !(await isConfiguredVoiceChannel(body.toChannelId))) return failure(400, "INVALID_CHANNEL", "Canal inválido.");
      const service = roomService();
      await service.moveParticipant(roomNames.voice(body.fromChannelId), body.identity, roomNames.voice(body.toChannelId));
      await service.updateParticipant(roomNames.lobby, body.identity, { attributes: { voiceChannelId: body.toChannelId } });
      await addAdminLog(admin.displayName, "Usuário movido", `${body.identity}: ${body.fromChannelId} → ${body.toChannelId}`);
      return NextResponse.json({ ok: true });
    }

    return failure(400, "INVALID_REQUEST", "Ação administrativa inválida.");
  } catch (cause) {
    console.error("Admin operation failed", cause);
    return failure(503, "ADMIN_OPERATION_FAILED", "A operação não pôde ser concluída.");
  }
}
