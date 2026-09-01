import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) throw new Error("SUPABASE_NOT_CONFIGURED");
  return value;
}

function publishableKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!value) throw new Error("SUPABASE_NOT_CONFIGURED");
  return value;
}

/** Supabase SSR client. It is ready for Supabase Auth sessions if we add them later. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), publishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Route handlers can write cookies; Server Components can only read them.
        }
      },
    },
  });
}

/** Server-only data client. Prefer a secret/service key in production; the publishable key keeps the MVP usable locally. */
export function createSupabaseDataClient(accessToken?: string) {
  const key = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || publishableKey();

  return createClient(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        "x-application-name": "discord-gurizada",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    },
  });
}
