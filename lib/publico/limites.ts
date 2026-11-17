import "server-only";

import { hmacHex } from "@/lib/crypto/hash";
import { serverEnv } from "@/lib/env.server";
import { createServiceClient } from "@/lib/supabase/service";

// Guarda o HMAC do IP, nunca o IP.
export async function dentroDoLimite(
  acao: "abrir" | "codigo" | "responder" | "comprovante" | "verificar",
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
  // Se o limitador falhar, não bloqueia: as regras do banco continuam valendo.
  return error ? true : data !== false;
}
