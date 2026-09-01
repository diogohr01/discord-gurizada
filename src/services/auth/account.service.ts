import { createClient, type Session } from "@supabase/supabase-js";

import type { ApiError, TokenSuccess } from "@/types/realtime";

let browserClient: ReturnType<typeof createClient> | null = null;

function getBrowserClient() {
  if (typeof window === "undefined") throw new Error("AUTH_BROWSER_ONLY");
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_NOT_CONFIGURED");
    browserClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: window.localStorage,
      },
    });
  }
  return browserClient;
}

function siteUrl(path = "") {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return `${configured || window.location.origin}${path}`;
}

async function saveAccountProfile(session: Session, username: string, accessCode: string) {
  const response = await fetch("/api/account/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ username, accessCode }),
  });
  const payload = await response.json() as ApiError;
  if (!response.ok) throw new Error(payload.message || "Não foi possível preparar a conta.");
}

export async function signUpAccount(email: string, username: string, password: string, accessCode: string) {
  const { data, error } = await getBrowserClient().auth.signUp({ email, password, options: { emailRedirectTo: siteUrl("/") } });
  if (error) throw error;
  if (!data.session) return { needsConfirmation: true };
  await saveAccountProfile(data.session, username, accessCode);
  return { needsConfirmation: false };
}

export async function resendSignupConfirmation(email: string) {
  const { error } = await getBrowserClient().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: siteUrl("/") },
  });
  if (error) throw error;
}

export async function signInAccount(email: string, password: string): Promise<string> {
  const { data, error } = await getBrowserClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error || new Error("Não foi possível entrar com essa conta.");
  return data.session.access_token;
}

export async function getStoredAccountToken(): Promise<string | null> {
  const { data } = await getBrowserClient().auth.getSession();
  return data.session?.access_token || null;
}

export async function requestPasswordReset(email: string) {
  const { error } = await getBrowserClient().auth.resetPasswordForEmail(email, { redirectTo: siteUrl("/reset-password") });
  if (error) throw error;
}

export async function updateAccountPassword(password: string) {
  const { error } = await getBrowserClient().auth.updateUser({ password });
  if (error) throw error;
}

export async function getAccountRealtimeToken(accessToken: string): Promise<TokenSuccess> {
  const response = await fetch("/api/livekit/token", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: "account", accessToken }),
  });
  const payload = await response.json() as TokenSuccess | ApiError;
  if (!response.ok) throw new Error((payload as ApiError).message || "Não foi possível restaurar a conta.");
  return payload as TokenSuccess;
}

export async function signOutAccount() {
  if (typeof window !== "undefined") await getBrowserClient().auth.signOut();
}
