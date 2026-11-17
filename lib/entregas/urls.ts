import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { caminhoFotoValido, type FotoEntrega } from "@/lib/validation/entrega";

// Só assina caminhos desta pasta: na página do cliente o servidor usa a service_role.
export async function urlsDasFotos(
  supabase: SupabaseClient<Database>,
  fotos: Pick<FotoEntrega, "path">[],
  prestadorId: string,
  propostaId: string,
  segundos = 3600,
): Promise<Record<string, string>> {
  const caminhos = fotos
    .map((f) => f.path)
    .filter((p) => caminhoFotoValido(p, prestadorId, propostaId));
  if (caminhos.length === 0) return {};
  const { data } = await supabase.storage.from("entregas").createSignedUrls(caminhos, segundos);
  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
  }
  return urls;
}
