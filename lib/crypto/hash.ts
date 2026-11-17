import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { canonicalize } from "@/lib/crypto/canonical";

export function sha256Hex(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

export function sha256Bytes(dados: Uint8Array): string {
  return createHash("sha256").update(dados).digest("hex");
}

export function hashDocumento(documento: unknown): string {
  return sha256Hex(canonicalize(documento));
}

export function hashConfere(documento: unknown, hashGravado: string | null): boolean {
  if (!hashGravado || !/^[0-9a-f]{64}$/.test(hashGravado)) return false;
  return iguais(hashDocumento(documento), hashGravado);
}

// Com segredo: quem vazar o banco não consegue testar os 10⁶ códigos possíveis.
export function hmacHex(segredo: string, texto: string): string {
  return createHmac("sha256", segredo).update(texto, "utf8").digest("hex");
}

// Tempo constante: não vaza pelo tempo de resposta quantos caracteres batem.
export function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
