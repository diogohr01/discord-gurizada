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

function profileKeys(session: Awaited<ReturnType<typeof getCurrentSession>>): string[] {
  if (!session) return [];
  return [...new Set([session.identity, session.accountId, session.displayName].filter((value): value is string => Boolean(value)))];
}

async function findProfile(client: ReturnType<typeof createSupabaseDataClient>, session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>) {
  const keys = profileKeys(session);
  const result = await client.from("profiles").select("profile_key, avatar_path").in("profile_key", keys);
  if (result.error) throw result.error;
  return keys.map((key) => result.data.find((profile) => profile.profile_key === key)).find(Boolean) || null;
}

async function profileForSession() {
  const session = await getCurrentSession();
  if (!session) return null;
  const client = createSupabaseDataClient();
  const profile = await findProfile(client, session);
  const path = profile?.avatar_path;
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
    const profileKey = session.identity;
    const previous = await findProfile(client, session);
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
    if (previous?.avatar_path) await client.storage.from(PROFILE_BUCKET).remove([previous.avatar_path]);

    const signed = await client.storage.from(PROFILE_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signed.error) throw signed.error;
    return NextResponse.json({ avatarUrl: signed.data.signedUrl });
  } catch (cause) {
    console.error("Profile write failed", cause);
    return failure(503, "DATABASE_UNAVAILABLE", "Não foi possível salvar a foto do perfil.");
  }
}
