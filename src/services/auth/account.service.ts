import { createClient } from "@supabase/supabase-js";

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

async function readAccountResponse(response: Response) {
  const payload = await response.json() as {
    accessToken?: string | null;
    refreshToken?: string | null;
    needsConfirmation?: boolean;
    message?: string;
  };
  if (!response.ok) throw new Error(payload.message || "Não foi possível preparar a conta.");
  return payload;
}

async function setBrowserSession(accessToken: string, refreshToken: string) {
  const { error } = await getBrowserClient().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
}

export async function signUpAccount(email: string, username: string, password: string, accessCode: string) {
  const payload = await readAccountResponse(await fetch("/api/account/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password, accessCode }),
  }));
  if (payload.accessToken && payload.refreshToken) await setBrowserSession(payload.accessToken, payload.refreshToken);
  return { needsConfirmation: Boolean(payload.needsConfirmation) };
}

export async function resendSignupConfirmation(email: string) {
  const { error } = await getBrowserClient().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: siteUrl("/") },
  });
  if (error) throw error;
}

export async function signInAccount(username: string, password: string): Promise<string> {
  const payload = await readAccountResponse(await fetch("/api/account/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }));
  if (!payload.accessToken || !payload.refreshToken) throw new Error("Não foi possível entrar com essa conta.");
  await setBrowserSession(payload.accessToken, payload.refreshToken);
  return payload.accessToken;
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
