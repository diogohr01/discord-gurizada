import { NextResponse } from "next/server";

import { createSupabaseDataClient } from "@/lib/supabase/server";
import { normalizeUsernameKey, SESSION_COOKIE_NAME, validateNickname } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return failure(415, "UNSUPPORTED_MEDIA", "Envie os dados como JSON.");
  }

  try {
    const body = await request.json() as { username?: unknown; password?: unknown };
    const username = validateNickname(body.username);
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || password.length < 6) return failure(401, "AUTH_REQUIRED", "Usuário ou senha inválidos.");

    const client = createSupabaseDataClient();
    const account = await client.from("users").select("id, email, username").eq("username_key", normalizeUsernameKey(username)).maybeSingle();
    if (account.error) throw account.error;
    if (!account.data) return failure(401, "AUTH_REQUIRED", "Usuário ou senha inválidos.");

    const authenticated = await client.auth.signInWithPassword({ email: account.data.email, password });
    if (authenticated.error || !authenticated.data.session) return failure(401, "AUTH_REQUIRED", "Usuário ou senha inválidos.");

    const response = NextResponse.json({
      accessToken: authenticated.data.session.access_token,
      refreshToken: authenticated.data.session.refresh_token,
    });
    response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return response;
  } catch (cause) {
    console.error("Account login failed", cause);
    return failure(503, "AUTH_UNAVAILABLE", "Não foi possível entrar com a conta agora.");
  }
}
