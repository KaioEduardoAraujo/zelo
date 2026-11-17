import { hashDocumento } from "@/lib/crypto/hash";
import type { Referencia } from "@/lib/proposals/envio";
import { clienteSchema, type Cliente } from "@/lib/validation/proposta";
import {
  entregaSeladaSchema,
  normalizarEntrega,
  validarEntrega,
  type EntregaSelada,
} from "@/lib/validation/entrega";
import { flattenIssues } from "@/lib/validation/errors";

/*
 * Documento selado do aceite de ENTREGA (lógica pura, sem banco): mesmo desenho da proposta
 * (conteúdo + retrato das partes + identidade do registro, D52), mais a referência à proposta
 * original e as fotos com o SHA-256 conferido pelo servidor.
 */

export type DocumentoEntrega = EntregaSelada & {
  proposta_id: string;
  versao: number;
  titulo: string;
  prestador: { nome: string; empresa: string | null };
  cliente: { nome: string; email: string; telefone: string | null };
  referencia: Referencia;
};

export type FotoSeladaEntrada = {
  path: string;
  nome: string;
  sha256: string;
  bytes: number;
  tipo: string;
};

export type PrepararEntregaEntrada = {
  propostaId: string;
  versao: number;
  titulo: string;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone: string | null;
  prestadorNome: string;
  prestadorEmpresa: string | null;
  /** jsonb da versão em rascunho, como está no banco. */
  conteudo: unknown;
  referencia: Referencia;
  /** Fotos já conferidas pelo servidor (mesma ordem e mesmos caminhos do rascunho). */
  fotosSeladas: FotoSeladaEntrada[];
};

export type PrepararEntregaResultado =
  | { ok: true; documento: DocumentoEntrega; hash: string }
  | { ok: false; erros: Record<string, string> };

export function prepararDocumentoEntrega(e: PrepararEntregaEntrada): PrepararEntregaResultado {
  const conteudo = normalizarEntrega(e.conteudo);
  const erros = validarEntrega(conteudo);

  const dadosCliente: Cliente = {
    nome: e.clienteNome,
    email: e.clienteEmail,
    telefone: e.clienteTelefone ?? "",
    titulo: e.titulo,
  };
  const cliente = clienteSchema.safeParse(dadosCliente);
  if (!cliente.success) Object.assign(erros, { form: "Os dados do cliente estão incompletos." });
  if (Object.keys(erros).length > 0 || !cliente.success) return { ok: false, erros };

  // As fotos seladas precisam ser exatamente as do rascunho, na mesma ordem.
  const mesmas =
    e.fotosSeladas.length === conteudo.fotos.length &&
    e.fotosSeladas.every((f, i) => f.path === conteudo.fotos[i].path);
  if (!mesmas) return { ok: false, erros: { fotos: "As fotos mudaram. Tente enviar de novo." } };

  const selada = entregaSeladaSchema.safeParse({ ...conteudo, fotos: e.fotosSeladas });
  if (!selada.success) return { ok: false, erros: flattenIssues(selada.error) };

  const documento: DocumentoEntrega = {
    ...selada.data,
    proposta_id: e.propostaId,
    versao: e.versao,
    titulo: cliente.data.titulo,
    prestador: { nome: e.prestadorNome.trim(), empresa: e.prestadorEmpresa?.trim() || null },
    cliente: {
      nome: cliente.data.nome,
      email: cliente.data.email,
      telefone: cliente.data.telefone ?? null,
    },
    referencia: e.referencia,
  };
  return { ok: true, documento, hash: hashDocumento(documento) };
}
