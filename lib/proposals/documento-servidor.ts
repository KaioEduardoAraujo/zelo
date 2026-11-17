import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Profile } from "@/lib/auth/dal";
import { prepararDocumentoEntrega } from "@/lib/entregas/envio";
import { selarFotos } from "@/lib/entregas/fotos";
import { normalizarConteudo } from "@/lib/proposals/draft";
import { prepararDocumento, type Referencia } from "@/lib/proposals/envio";
import type { TipoDocumento } from "@/lib/tipos";
import type { Database } from "@/lib/supabase/database.types";
import { normalizarEntrega } from "@/lib/validation/entrega";

type Proposta = {
  id: string;
  tipo: TipoDocumento;
  proposta_pai_id: string | null;
  titulo: string;
  cliente_nome: string;
  cliente_email: string;
  cliente_telefone: string | null;
  versao_atual: number;
};

export type DocumentoPronto =
  | {
      ok: true;
      documento: object & { validade_dias: number; titulo: string };
      hash: string;
      valorCentavos: number | null;
    }
  | { ok: false; message?: string; erros?: Record<string, string> };

export async function lerReferencia(
  supabase: SupabaseClient<Database>,
  paiId: string,
): Promise<Referencia | null> {
  const { data: pai } = await supabase
    .from("propostas")
    .select("id, titulo, versao_atual")
    .eq("id", paiId)
    .maybeSingle();
  if (!pai) return null;
  const { data: versao } = await supabase
    .from("proposta_versoes")
    .select("hash_sha256")
    .eq("proposta_id", paiId)
    .eq("numero", pai.versao_atual)
    .maybeSingle();
  if (!versao?.hash_sha256) return null;
  return { proposta_id: pai.id, titulo: pai.titulo, hash_documento: versao.hash_sha256 };
}

// Sempre a partir do banco, nunca do que o navegador mostra.
export async function prepararParaEnvio(
  supabase: SupabaseClient<Database>,
  profile: Pick<Profile, "id" | "nome" | "empresa_nome">,
  proposta: Proposta,
  conteudoBruto: unknown,
): Promise<DocumentoPronto> {
  const comum = {
    propostaId: proposta.id,
    versao: proposta.versao_atual,
    titulo: proposta.titulo,
    clienteNome: proposta.cliente_nome,
    clienteEmail: proposta.cliente_email,
    clienteTelefone: proposta.cliente_telefone,
    prestadorNome: profile.nome,
    prestadorEmpresa: profile.empresa_nome,
    conteudo: conteudoBruto,
  };

  let referencia: Referencia | undefined;
  if (proposta.tipo !== "proposta") {
    const ref = proposta.proposta_pai_id
      ? await lerReferencia(supabase, proposta.proposta_pai_id)
      : null;
    if (!ref) return { ok: false, message: "Não encontramos a proposta original deste documento." };
    referencia = ref;
  }

  if (proposta.tipo === "entrega") {
    const conteudo = normalizarEntrega(conteudoBruto);
    // Só baixa as fotos se o resto estiver válido.
    const previa = prepararDocumentoEntrega({
      ...comum,
      referencia: referencia!,
      fotosSeladas: conteudo.fotos.map((f) => ({
        path: f.path,
        nome: f.nome,
        sha256: "0".repeat(64),
        bytes: 1,
        tipo: "image/jpeg",
      })),
    });
    if (!previa.ok && Object.keys(previa.erros).some((k) => !k.startsWith("fotos"))) {
      return { ok: false, erros: previa.erros };
    }

    const seladas = await selarFotos(supabase, conteudo.fotos, profile.id, proposta.id);
    if (!seladas.ok) return { ok: false, erros: seladas.erros };

    const r = prepararDocumentoEntrega({
      ...comum,
      referencia: referencia!,
      fotosSeladas: seladas.fotos,
    });
    return r.ok
      ? { ok: true, documento: r.documento, hash: r.hash, valorCentavos: null }
      : { ok: false, erros: r.erros };
  }

  const r = prepararDocumento({ ...comum, referencia });
  return r.ok
    ? {
        ok: true,
        documento: r.documento,
        hash: r.hash,
        valorCentavos: r.documento.valor_total_centavos,
      }
    : { ok: false, erros: r.erros };
}

export function valorDaVersao(tipo: TipoDocumento, conteudoBruto: unknown): number | null {
  return tipo === "entrega" ? null : normalizarConteudo(conteudoBruto).valor_total_centavos;
}
