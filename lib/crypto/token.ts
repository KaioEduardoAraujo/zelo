import { randomBytes } from "node:crypto";

import { hmacHex } from "@/lib/crypto/hash";

/** 32 bytes = 256 bits de entropia (regra inegociável nº 4: no mínimo 32 bytes). */
export const TOKEN_BYTES = 32;

/**
 * Token do link da proposta: 32 bytes do gerador criptográfico do sistema, em base64url
 * (43 caracteres, seguros para URL). Só existe na resposta que o entrega ao prestador: o banco
 * guarda apenas o HMAC dele (`hashToken`).
 */
export function gerarToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Formato válido de um token (evita consultar o banco com lixo vindo da URL). */
export function tokenValido(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** O que vai para `propostas.token_hash`. O segredo é o HASH_PEPPER (só no servidor). */
export function hashToken(segredo: string, token: string): string {
  return hmacHex(segredo, token);
}
