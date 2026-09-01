import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, verifySession } from "@/lib/session";
import type { SessionPayload } from "@/types/realtime";

export async function getCurrentSession(): Promise<SessionPayload | null> {
  const secret = process.env.MVP_SESSION_SECRET;
  if (!secret) return null;
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(SESSION_COOKIE_NAME)?.value, secret);
}

