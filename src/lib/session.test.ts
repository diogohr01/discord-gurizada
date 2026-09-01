// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  createIdentity,
  safeSecretEqual,
  signSession,
  validateNickname,
  verifySession,
} from "./session";

describe("sessão privada", () => {
  it("normaliza nicknames e rejeita valores inválidos", () => {
    expect(validateNickname("  Diogo   Rodrigues ")).toBe("Diogo Rodrigues");
    expect(validateNickname("D")).toBeNull();
    expect(validateNickname("A".repeat(33))).toBeNull();
    expect(validateNickname("Nome\u0000")).toBeNull();
  });

  it("gera uma identidade LiveKit única e legível", () => {
    const first = createIdentity("João da Silva");
    const second = createIdentity("João da Silva");
    expect(first).toMatch(/^joao-da-silva_[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
  });

  it("compara o código sem expor diferença de tamanho", () => {
    expect(safeSecretEqual("segredo", "segredo")).toBe(true);
    expect(safeSecretEqual("incorreto", "segredo")).toBe(false);
  });

  it("assina, valida e expira a sessão", () => {
    const secret = "uma-chave-de-sessao-longa";
    const payload = { identity: "diogo_uuid", displayName: "Diogo", role: "member" as const, expiresAt: 2_000 };
    const token = signSession(payload, secret);
    expect(verifySession(token, secret, 1_000)).toEqual(payload);
    expect(verifySession(token, secret, 3_000)).toBeNull();
    expect(verifySession(`${token}x`, secret, 1_000)).toBeNull();
    expect(verifySession(token, "outra-chave", 1_000)).toBeNull();
  });
});
