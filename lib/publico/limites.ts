import "server-only";

import { hmacHex } from "@/lib/crypto/hash";
import { serverEnv } from "@/lib/env.server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Limite de taxa por IP para as ações da página pública (D17), no Postgres.
 * A chave guarda o HMAC do IP, nunca o IP (LGPD). Sem IP conhecido (fora da Vercel), vale só o
 * limite por proposta que o próprio banco aplica aos códigos (3 por hora).
 */
export async function dentroDoLimite(
  acao: "abrir" | "codigo" | "responder",
  ip: string | undefined,
  limite: number,
  janelaSegundos: number,
): Promise<boolean> {
  if (!ip) return true;
  const chave = `${acao}:${hmacHex(serverEnv().HASH_PEPPER, ip).slice(0, 32)}`;
  const { data, error } = await createServiceClient().rpc("consumir_limite", {
    p_chave: chave,
    p_limite: limite,
    p_janela_segundos: janelaSegundos,
  });
  // Se o limitador falhar, NÃO bloqueia o cliente: as regras do banco continuam valendo.
  return error ? true : data !== false;
}
