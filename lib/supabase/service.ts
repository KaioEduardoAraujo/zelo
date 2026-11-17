import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { serverEnv } from "@/lib/env.server";

// service_role ignora o RLS: só no servidor e só depois de validar o token.
export function createServiceClient() {
  return createClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
