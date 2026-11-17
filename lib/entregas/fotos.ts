import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sha256Bytes } from "@/lib/crypto/hash";
import type { FotoSeladaEntrada } from "@/lib/entregas/envio";
import type { Database } from "@/lib/supabase/database.types";
import {
  FOTO_BYTES_MAX,
  caminhoFotoValido,
  tipoPelosBytes,
  type FotoEntrega,
} from "@/lib/validation/entrega";

/**
 * Sela as fotos no momento do ENVIO. O servidor baixa cada arquivo do bucket privado com a
 * sessão do prestador (o RLS só deixa ler a própria pasta), confere:
 *   - o caminho é da pasta deste prestador e desta entrega;
 *   - o tipo, pelos primeiros bytes (a extensão e o Content-Type não são confiáveis);
 *   - o tamanho;
 * e calcula o SHA-256 dos bytes. Nada do que o navegador diz sobre a foto é usado.
 */
export async function selarFotos(
  supabase: SupabaseClient<Database>,
  fotos: FotoEntrega[],
  prestadorId: string,
  propostaId: string,
): Promise<
  { ok: true; fotos: FotoSeladaEntrada[] } | { ok: false; erros: Record<string, string> }
> {
  const erros: Record<string, string> = {};
  const seladas: FotoSeladaEntrada[] = [];

  for (const [i, foto] of fotos.entries()) {
    if (!caminhoFotoValido(foto.path, prestadorId, propostaId)) {
      erros[`fotos.${i}.path`] = "Foto inválida. Remova e anexe de novo.";
      continue;
    }
    const { data, error } = await supabase.storage.from("entregas").download(foto.path);
    if (error || !data) {
      erros[`fotos.${i}.path`] = "Não encontramos esta foto. Remova e anexe de novo.";
      continue;
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    const tipo = tipoPelosBytes(bytes);
    if (!tipo) {
      erros[`fotos.${i}.path`] = "Este arquivo não é uma imagem JPG, PNG ou WebP.";
      continue;
    }
    if (bytes.length > FOTO_BYTES_MAX) {
      erros[`fotos.${i}.path`] = "Foto grande demais (máximo de 2 MB).";
      continue;
    }
    seladas.push({
      path: foto.path,
      nome: foto.nome,
      sha256: sha256Bytes(bytes),
      bytes: bytes.length,
      tipo,
    });
  }

  return Object.keys(erros).length > 0 ? { ok: false, erros } : { ok: true, fotos: seladas };
}
