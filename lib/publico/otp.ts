import { randomInt } from "node:crypto";

import { hmacHex } from "@/lib/crypto/hash";

export type AcaoCliente = "aceito" | "recusado" | "ajuste";

export function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function codigoValido(codigo: unknown): codigo is string {
  return typeof codigo === "string" && /^\d{6}$/.test(codigo);
}

// HMAC amarrado à proposta e à ação: um código pedido para recusar não serve para aceitar.
export function hashCodigo(
  segredo: string,
  propostaId: string,
  acao: AcaoCliente,
  codigo: string,
): string {
  return hmacHex(segredo, `${propostaId}:${acao}:${codigo}`);
}
