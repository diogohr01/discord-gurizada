import { NextResponse } from "next/server";

import { createSupabaseDataClient } from "@/lib/supabase/server";
import { normalizeUsernameKey, safeSecretEqual, SESSION_COOKIE_NAME, validateNickname } from "@/lib/session";

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
    const body = await request.json() as { email?: unknown; username?: unknown; password?: unknown; accessCode?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const username = validateNickname(body.username);
    const password = typeof body.password === "string" ? body.password : "";
    const serverCode = process.env.MVP_ACCESS_CODE;

    if (!email || !email.includes("@") || !username || password.length < 6 || typeof body.accessCode !== "string" || !serverCode || !safeSecretEqual(body.accessCode, serverCode)) {
      return failure(401, "ACCESS_DENIED", "Usuário, senha ou código de acesso inválido.");
    }

    const hasServerKey = Boolean(process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
    if (!hasServerKey) {
      return failure(503, "SERVER_MISCONFIGURED", "O cadastro de contas exige SUPABASE_SECRET_KEY configurada no servidor.");
    }

    const client = createSupabaseDataClient();
    const existing = await client.from("users").select("id").eq("username_key", normalizeUsernameKey(username)).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return failure(409, "USERNAME_TAKEN", "Esse usuário já está sendo usado.");

    const created = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || new URL(request.url).origin}/`, data: { username } },
    });
    if (created.error || !created.data.user?.id) {
      return failure(400, "SIGNUP_FAILED", created.error?.message || "Não foi possível criar a conta.");
    }

    const profile = await client.from("users").insert({
      id: created.data.user.id,
      email,
      username,
      updated_at: new Date().toISOString(),
    }).select("id, username, email").single();
    if (profile.error) {
      const cleanup = await client.auth.admin.deleteUser(created.data.user.id);
      if (cleanup.error) console.error("Account signup cleanup failed", cleanup.error);
      if (profile.error.code === "23505") return failure(409, "USERNAME_TAKEN", "Esse usuário já está sendo usado.");
      throw profile.error;
    }

    const response = NextResponse.json({
      needsConfirmation: !created.data.session,
      accessToken: created.data.session?.access_token || null,
      refreshToken: created.data.session?.refresh_token || null,
    });
    response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return response;
  } catch (cause) {
    console.error("Account signup failed", cause);
    return failure(503, "DATABASE_UNAVAILABLE", "Não foi possível preparar a conta agora.");
  }
}
