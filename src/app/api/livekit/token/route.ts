import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createLobbyToken, createVoiceToken } from "@/lib/livekit/server";
import { isConfiguredVoiceChannel } from "@/lib/server-state";
import { createSupabaseDataClient } from "@/lib/supabase/server";
import {
  createIdentity,
  safeSecretEqual,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  validateNickname,
  verifySession,
} from "@/lib/session";
import type { ApiError, SessionPayload, TokenRequest } from "@/types/realtime";

export const runtime = "nodejs";

function error(status: number, code: string, message: string) {
  return NextResponse.json<ApiError>({ code, message }, { status });
}

function serverSecrets() {
  const accessCode = process.env.MVP_ACCESS_CODE;
  const sessionSecret = process.env.MVP_SESSION_SECRET;
  if (!accessCode || !sessionSecret) throw new Error("MVP_NOT_CONFIGURED");
  return { accessCode, sessionSecret, adminToken: process.env.MVP_ADMIN_TOKEN };
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return error(415, "UNSUPPORTED_MEDIA", "Envie os dados como JSON.");
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return error(400, "INVALID_REQUEST", "Não foi possível ler a solicitação.");
  }
  if (typeof rawBody !== "object" || rawBody === null) {
    return error(400, "INVALID_REQUEST", "A solicitação não é válida.");
  }
  const body = rawBody as TokenRequest;

  try {
    const { accessCode, sessionSecret, adminToken } = serverSecrets();
    if (body.action === "account") {
      if (typeof body.accessToken !== "string" || !body.accessToken) return error(401, "AUTH_REQUIRED", "Entre com sua conta primeiro.");
      const client = createSupabaseDataClient(body.accessToken);
      const auth = await client.auth.getUser(body.accessToken);
      if (auth.error || !auth.data.user?.id) return error(401, "AUTH_REQUIRED", "A sessão da conta expirou.");
      const account = await client.from("users").select("id, username").eq("id", auth.data.user.id).maybeSingle();
      if (account.error) throw account.error;
      if (!account.data) return error(403, "ACCOUNT_NOT_READY", "Essa conta ainda não foi preparada para este servidor.");
      const session: SessionPayload = {
        identity: `account_${account.data.id}`,
        displayName: account.data.username,
        role: "member",
        accountId: account.data.id,
        expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
      };
      const response = NextResponse.json(await createLobbyToken(session));
      response.cookies.set(SESSION_COOKIE_NAME, signSession(session, sessionSecret), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
        priority: "high",
      });
      return response;
    }
    if (body.action === "enter") {
      const nickname = validateNickname(body.nickname);
      if (
        !nickname ||
        typeof body.accessCode !== "string" ||
        !safeSecretEqual(body.accessCode, accessCode)
      ) {
        return error(401, "ACCESS_DENIED", "Nome ou código de acesso inválido.");
      }
      if (
        typeof body.adminToken === "string" &&
        (!adminToken || !safeSecretEqual(body.adminToken, adminToken))
      ) {
        return error(401, "ACCESS_DENIED", "Nome ou código de acesso inválido.");
      }

      const session: SessionPayload = {
        identity: createIdentity(nickname),
        displayName: nickname,
        role:
          typeof body.adminToken === "string" &&
          Boolean(adminToken) &&
          safeSecretEqual(body.adminToken, adminToken as string)
            ? "admin"
            : "member",
        expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
      };
      const response = NextResponse.json(await createLobbyToken(session));
      response.cookies.set(SESSION_COOKIE_NAME, signSession(session, sessionSecret), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
        priority: "high",
      });
      return response;
    }

    if (body.action === "restore") {
      const cookieStore = await cookies();
      const session = verifySession(
        cookieStore.get(SESSION_COOKIE_NAME)?.value,
        sessionSecret,
      );
      if (!session || session.accountId) {
        return error(401, "SESSION_EXPIRED", "Sua sessÃ£o expirou. Entre novamente.");
      }
      return NextResponse.json(await createLobbyToken(session));
    }

    if (body.action === "voice" && await isConfiguredVoiceChannel(body.channelId)) {
      const cookieStore = await cookies();
      const session = verifySession(
        cookieStore.get(SESSION_COOKIE_NAME)?.value,
        sessionSecret,
      );
      if (!session) {
        return error(401, "SESSION_EXPIRED", "Sua sessão expirou. Entre novamente.");
      }
      return NextResponse.json(await createVoiceToken(session, body.channelId));
    }

    return error(400, "INVALID_REQUEST", "A solicitação não é válida.");
  } catch (cause) {
    console.error("Token endpoint failed", cause);
    return error(503, "SERVICE_UNAVAILABLE", "O servidor de voz não está disponível.");
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
