import { NextResponse } from "next/server";

import { createSupabaseDataClient } from "@/lib/supabase/server";
import { safeSecretEqual, validateNickname } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export async function POST(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) return failure(401, "AUTH_REQUIRED", "Entre com sua conta primeiro.");

  try {
    const body = await request.json() as { username?: unknown; accessCode?: unknown };
    const username = validateNickname(body.username);
    const serverCode = process.env.MVP_ACCESS_CODE;
    if (!username || typeof body.accessCode !== "string" || !serverCode || !safeSecretEqual(body.accessCode, serverCode)) {
      return failure(401, "ACCESS_DENIED", "Usuário ou código de acesso inválido.");
    }

    const client = createSupabaseDataClient(accessToken);
    const auth = await client.auth.getUser(accessToken);
    if (auth.error || !auth.data.user?.id || !auth.data.user.email) return failure(401, "AUTH_REQUIRED", "A sessão da conta expirou.");
    const saved = await client.from("users").upsert({
      id: auth.data.user.id,
      email: auth.data.user.email,
      username,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" }).select("id, username, email").single();
    if (saved.error) {
      if (saved.error.code === "23505") return failure(409, "USERNAME_TAKEN", "Esse usuário já está sendo usado.");
      throw saved.error;
    }
    return NextResponse.json({ id: saved.data.id, username: saved.data.username, email: saved.data.email });
  } catch (cause) {
    console.error("Account profile failed", cause);
    return failure(503, "DATABASE_UNAVAILABLE", "Não foi possível preparar a conta agora.");
  }
}
