import "server-only";

import { isIP } from "node:net";

import { headers } from "next/headers";

// x-forwarded-for só é confiável atrás da Vercel.
export async function origemDaRequisicao(): Promise<{ ip?: string; userAgent?: string }> {
  const h = await headers();
  const encaminhado = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: encaminhado && isIP(encaminhado) ? encaminhado : undefined,
    userAgent: h.get("user-agent")?.slice(0, 512) || undefined,
  };
}
