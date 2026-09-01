import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/session-server";
import { createSupabaseDataClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROFILE_BUCKET = "profile-avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

async function profileForSession() {
  const session = await getCurrentSession();
  if (!session) return null;
  const profileKey = session.accountId || session.displayName;
  const client = createSupabaseDataClient();
  const result = await client.from("profiles").select("avatar_path").eq("profile_key", profileKey).maybeSingle();
  if (result.error) throw result.error;
  const path = result.data?.avatar_path;
  if (!path) return { session, avatarUrl: null as string | null };
  const signed = await client.storage.from(PROFILE_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signed.error) throw signed.error;
  return { session, avatarUrl: signed.data.signedUrl };
}

export async function GET() {
  try {
    const profile = await profileForSession();
    if (!profile) return failure(401, "SESSION_EXPIRED", "Sua sessão expirou. Entre novamente.");
    return NextResponse.json({ avatarUrl: profile.avatarUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Profile read failed", cause);
    return failure(503, "DATABASE_UNAVAILABLE", "O perfil não está disponível agora.");
  }
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return failure(401, "SESSION_EXPIRED", "Sua sessão expirou. Entre novamente.");

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_AVATAR_BYTES || !ALLOWED_TYPES.has(file.type)) {
      return failure(400, "INVALID_AVATAR", "Escolha uma imagem PNG, JPG, WEBP ou GIF de até 5 MB.");
    }

    const client = createSupabaseDataClient();
    const profileKey = session.accountId || session.displayName;
    const previous = await client.from("profiles").select("avatar_path").eq("profile_key", profileKey).maybeSingle();
    if (previous.error) throw previous.error;
    const path = `${profileKey}/${randomUUID()}.${EXTENSIONS[file.type]}`;
    const upload = await client.storage.from(PROFILE_BUCKET).upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
    if (upload.error) throw upload.error;

    const saved = await client.from("profiles").upsert({
      profile_key: profileKey,
      display_name: session.displayName,
      avatar_path: path,
      updated_at: new Date().toISOString(),
    }, { onConflict: "profile_key" }).select("avatar_path").single();
    if (saved.error) {
      await client.storage.from(PROFILE_BUCKET).remove([path]);
      throw saved.error;
    }
    if (previous.data?.avatar_path) await client.storage.from(PROFILE_BUCKET).remove([previous.data.avatar_path]);

    const signed = await client.storage.from(PROFILE_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signed.error) throw signed.error;
    return NextResponse.json({ avatarUrl: signed.data.signedUrl });
  } catch (cause) {
    console.error("Profile write failed", cause);
    return failure(503, "DATABASE_UNAVAILABLE", "Não foi possível salvar a foto do perfil.");
  }
}
