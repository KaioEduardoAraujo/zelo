import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/*
 * Cliente com a chave service_role: IGNORA o RLS.
 *
 * Use apenas no servidor e apenas onde não existe usuário logado — as rotas públicas
 * do cliente (/p/[token]), que validam o token antes de qualquer consulta.
 * O "server-only" garante que este módulo nunca entra no bundle do navegador.
 */
export function createServiceClient() {
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
