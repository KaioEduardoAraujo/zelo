import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";

/*
 * Cliente do navegador. Usa só a chave pública (publishable/anon):
 * tudo o que ele consegue fazer é limitado pelas políticas RLS do banco.
 */
export function createClient() {
  const env = publicEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
