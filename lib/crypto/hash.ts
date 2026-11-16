import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { canonicalize } from "@/lib/crypto/canonical";

/** SHA-256 em hexadecimal minúsculo (64 caracteres), o formato que o banco exige. */
export function sha256Hex(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

/** Hash do documento: SHA-256 da serialização canônica. É o que fica na versão, no aceite e no PDF. */
export function hashDocumento(documento: unknown): string {
  return sha256Hex(canonicalize(documento));
}

/** Confere se o conteúdo guardado ainda produz o hash gravado no envio. */
export function hashConfere(documento: unknown, hashGravado: string | null): boolean {
  if (!hashGravado || !/^[0-9a-f]{64}$/.test(hashGravado)) return false;
  return iguais(hashDocumento(documento), hashGravado);
}

/**
 * HMAC-SHA256 com um segredo (o HASH_PEPPER). Usado para guardar o token do link e, depois, o
 * código OTP: sem o segredo, quem vazasse o banco não consegue conferir palpites (um OTP tem só
 * 10⁶ combinações; um SHA-256 puro seria quebrado em segundos).
 */
export function hmacHex(segredo: string, texto: string): string {
  return createHmac("sha256", segredo).update(texto, "utf8").digest("hex");
}

/** Comparação em tempo constante (não vaza, pelo tempo de resposta, quantos caracteres batem). */
export function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
