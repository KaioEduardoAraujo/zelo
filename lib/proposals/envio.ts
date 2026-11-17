import { hashDocumento } from "@/lib/crypto/hash";
import { formatCentavos, formatDateTime } from "@/lib/format";
import { normalizarConteudo, validarTudo, type DraftForm } from "@/lib/proposals/draft";
import type { TipoDocumento } from "@/lib/tipos";
import {
  clienteSchema,
  conteudoPropostaSchema,
  type ConteudoProposta,
} from "@/lib/validation/proposta";

/*
 * Lógica pura do envio (sem banco e sem React): monta o documento que será selado com o hash e
 * as mensagens do WhatsApp. Roda no servidor, nos testes e (a parte de mensagem) no navegador.
 */

/* ------------------------- Documento selado ------------------------- */

/**
 * O que o hash cobre. Além do conteúdo combinado, leva um RETRATO das partes (decisão D24) e a
 * identidade do registro:
 *  - prestador e cliente como eram no momento do envio: se o prestador mudar de nome depois, o
 *    documento enviado continua provando o que foi combinado;
 *  - `proposta_id` e `versao`: amarram o hash a ESTA proposta e a ESTA versão (dois documentos com
 *    o mesmo texto não geram o mesmo hash). O banco confere essas duas declarações.
 */
export type DocumentoEnviado = ConteudoProposta & {
  proposta_id: string;
  versao: number;
  titulo: string;
  prestador: { nome: string; empresa: string | null };
  cliente: { nome: string; email: string; telefone: string | null };
  /** Só em aditivo e entrega: a proposta aceita a que este documento se refere. */
  referencia?: Referencia;
};

/**
 * Amarra um aditivo (ou uma entrega) à proposta que o originou, DENTRO do documento selado:
 * o hash cobre o vínculo. `hash_documento` é o hash da versão aceita da proposta original, então
 * o comprovante do aditivo prova a qual versão exata ele se refere.
 */
export type Referencia = { proposta_id: string; titulo: string; hash_documento: string };

export type PrepararEntrada = {
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
  /** Obrigatório em aditivo e entrega. */
  referencia?: Referencia;
};

export type PrepararResultado =
  | { ok: true; documento: DocumentoEnviado; hash: string }
  | { ok: false; erros: Record<string, string> };

/**
 * Valida TUDO de novo (formato estrito, mesmo que o navegador já tenha validado: o servidor
 * nunca confia no que veio de fora) e monta o documento com o seu hash.
 */
export function prepararDocumento(e: PrepararEntrada): PrepararResultado {
  const form: DraftForm = {
    clienteNome: e.clienteNome,
    clienteEmail: e.clienteEmail,
    clienteTelefone: e.clienteTelefone ?? "",
    titulo: e.titulo,
    conteudo: normalizarConteudo(e.conteudo),
  };

  const erros = validarTudo(form);
  if (Object.keys(erros).length > 0) return { ok: false, erros };

  const conteudo = conteudoPropostaSchema.safeParse(normalizarConteudo(e.conteudo));
  const cliente = clienteSchema.safeParse({
    nome: e.clienteNome,
    email: e.clienteEmail,
    telefone: e.clienteTelefone ?? "",
    titulo: e.titulo,
  });
  if (!conteudo.success || !cliente.success)
    return { ok: false, erros: { form: "Documento inválido." } };

  const documento: DocumentoEnviado = {
    ...conteudo.data,
    proposta_id: e.propostaId,
    versao: e.versao,
    titulo: cliente.data.titulo,
    prestador: { nome: e.prestadorNome.trim(), empresa: e.prestadorEmpresa?.trim() || null },
    cliente: {
      nome: cliente.data.nome,
      email: cliente.data.email,
      telefone: cliente.data.telefone ?? null,
    },
    ...(e.referencia ? { referencia: e.referencia } : {}),
  };
  return { ok: true, documento, hash: hashDocumento(documento) };
}

/* ----------------------- Resumo e WhatsApp ----------------------- */

/** Tudo o que a tela "Proposta criada" precisa. O `link` com o token só existe nesta resposta. */
export type ResumoEnvio = {
  propostaId: string;
  tipo: TipoDocumento;
  versao: number;
  hash: string;
  link: string;
  /** ISO. */
  validadeEm: string;
  titulo: string;
  clienteNome: string;
  clienteTelefone: string | null;
  /** Empresa, ou o nome da pessoa quando não há empresa. */
  prestadorNome: string;
  /** null na entrega (não tem valor). */
  valorCentavos: number | null;
};

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

/** Mensagem pronta para colar na conversa: curta, humana e com o link no meio. */
export function mensagemWhatsApp(
  r: Pick<
    ResumoEnvio,
    "tipo" | "clienteNome" | "prestadorNome" | "titulo" | "valorCentavos" | "link" | "validadeEm"
  >,
): string {
  const abertura = `Olá, ${primeiroNome(r.clienteNome)}! Aqui é ${r.prestadorNome}.`;
  const valor = r.valorCentavos === null ? "" : `, no valor de ${formatCentavos(r.valorCentavos)}`;

  if (r.tipo === "entrega") {
    return [
      abertura,
      `O serviço “${r.titulo}” foi concluído. Segue o registro da entrega, com o que foi feito e as fotos.`,
      "",
      "Você pode conferir e confirmar o recebimento pelo celular, sem criar conta:",
      r.link,
      "",
      `O link vale até ${formatDateTime(r.validadeEm)}.`,
    ].join("\n");
  }

  const substantivo = r.tipo === "aditivo" ? "o aditivo" : "a proposta";
  return [
    abertura,
    `Segue ${substantivo} “${r.titulo}”${valor}.`,
    "",
    "Você pode ler e aceitar pelo celular, sem criar conta:",
    r.link,
    "",
    `${r.tipo === "aditivo" ? "O aditivo vale" : "A proposta vale"} até ${formatDateTime(r.validadeEm)}.`,
  ].join("\n");
}

/**
 * Telefone no formato do wa.me: código do país + DDD + número, só dígitos.
 * Aceita o que guardamos (DDD + número, 10 ou 11 dígitos) e já com o 55. Devolve null se não der
 * para saber, e aí o WhatsApp abre para a pessoa escolher o contato.
 */
export function telefoneWhatsApp(telefone: string | null | undefined): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

/** `https://wa.me/<numero>?text=<mensagem>`. Sem número válido, `https://wa.me/?text=...`. */
export function urlWhatsApp(telefone: string | null | undefined, mensagem: string): string {
  return `https://wa.me/${telefoneWhatsApp(telefone) ?? ""}?text=${encodeURIComponent(mensagem)}`;
}
