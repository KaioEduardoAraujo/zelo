import "server-only";

import { isIP } from "node:net";

import { headers } from "next/headers";

/**
 * IP e dispositivo de quem está agindo, para a trilha de auditoria e o limite de taxa.
 * O IP vem do `x-forwarded-for`, que a Vercel define (D60); só é usado se for um IP válido.
 * Nunca vão para o console.
 */
export async function origemDaRequisicao(): Promise<{ ip?: string; userAgent?: string }> {
  const h = await headers();
  const encaminhado = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: encaminhado && isIP(encaminhado) ? encaminhado : undefined,
    userAgent: h.get("user-agent")?.slice(0, 512) || undefined,
  };
}
