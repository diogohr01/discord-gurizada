import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { appConfig } from "@/config/app";
import type { SessionPayload } from "@/types/realtime";

export const SESSION_COOKIE_NAME = "discord_gurizada_session";
export const SESSION_MAX_AGE_SECONDS = appConfig.sessionHours * 60 * 60;

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signature(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function normalizeNickname(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function validateNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const nickname = normalizeNickname(raw);
  if (
    nickname.length < appConfig.nickname.minLength ||
    nickname.length > appConfig.nickname.maxLength ||
    /[\u0000-\u001f\u007f]/.test(nickname)
  ) {
    return null;
  }
  return nickname;
}

export function createIdentity(nickname: string): string {
  const slug = nickname
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20) || "user";
  return `${slug}_${randomUUID()}`;
}

export function safeSecretEqual(received: string, expected: string): boolean {
  const receivedHash = createHmac("sha256", "discord-gurizada-access").update(received).digest();
  const expectedHash = createHmac("sha256", "discord-gurizada-access").update(expected).digest();
  return timingSafeEqual(receivedHash, expectedHash);
}

export function signSession(payload: SessionPayload, secret: string): string {
  const encoded = base64Url(JSON.stringify(payload));
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): SessionPayload | null {
  if (!token) return null;
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) return null;

  const expectedSignature = signature(encoded, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (
      typeof payload.identity !== "string" ||
      typeof payload.displayName !== "string" ||
      (payload.role !== "member" && payload.role !== "admin") ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= now
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
