import { randomInt } from "node:crypto";

import { hmacHex } from "@/lib/crypto/hash";

export type AcaoCliente = "aceito" | "recusado" | "ajuste";

/** Código de 6 dígitos do gerador criptográfico do sistema (regra inegociável nº 5). */
export function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function codigoValido(codigo: unknown): codigo is string {
  return typeof codigo === "string" && /^\d{6}$/.test(codigo);
}

/**
 * O que o banco guarda: HMAC do código AMARRADO à proposta e à ação. Assim:
 *  - sem o segredo, quem vazar o banco não confere palpites (são só 10⁶ combinações);
 *  - um código pedido para RECUSAR não serve para ACEITAR (o e-mail diz para que ele é);
 *  - um código de uma proposta não vale em outra.
 */
export function hashCodigo(
  segredo: string,
  propostaId: string,
  acao: AcaoCliente,
  codigo: string,
): string {
  return hmacHex(segredo, `${propostaId}:${acao}:${codigo}`);
}
