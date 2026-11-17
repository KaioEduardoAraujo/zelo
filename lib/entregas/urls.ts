import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { caminhoFotoValido, type FotoEntrega } from "@/lib/validation/entrega";

/**
 * URLs assinadas (curta duração) das fotos de uma entrega, para mostrar na tela. O bucket é
 * privado: sem a URL assinada ninguém abre a foto (regra 7).
 *
 * Só assina caminhos da pasta DESTE prestador e DESTA entrega. O caminho vem de um documento que
 * o prestador montou; sem esta conferência, um caminho forjado faria o servidor (que, na página
 * do cliente, usa a service_role) assinar o arquivo de outra pessoa.
 */
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
