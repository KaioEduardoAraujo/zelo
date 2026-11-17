import { randomBytes } from "node:crypto";

import { hmacHex } from "@/lib/crypto/hash";

export const TOKEN_BYTES = 32;

// O banco guarda só o HMAC do token.
export function gerarToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function tokenValido(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function hashToken(segredo: string, token: string): string {
  return hmacHex(segredo, token);
}
