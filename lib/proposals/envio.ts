import { hashDocumento } from "@/lib/crypto/hash";
import { formatCentavos, formatDateTime } from "@/lib/format";
import { normalizarConteudo, validarTudo, type DraftForm } from "@/lib/proposals/draft";
import type { TipoDocumento } from "@/lib/tipos";
import {
  clienteSchema,
  conteudoPropostaSchema,
  type ConteudoProposta,
} from "@/lib/validation/proposta";

// O hash cobre o conteúdo, o retrato das partes (a prova continua se o prestador mudar de nome)
// e proposta_id + versao, que o banco confere.
export type DocumentoEnviado = ConteudoProposta & {
  proposta_id: string;
  versao: number;
  titulo: string;
  prestador: { nome: string; empresa: string | null };
  cliente: { nome: string; email: string; telefone: string | null };
  referencia?: Referencia;
};

// hash_documento é o hash da versão aceita da proposta original.
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
  conteudo: unknown;
  referencia?: Referencia;
};

export type PrepararResultado =
  | { ok: true; documento: DocumentoEnviado; hash: string }
  | { ok: false; erros: Record<string, string> };

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

export type ResumoEnvio = {
  propostaId: string;
  tipo: TipoDocumento;
  versao: number;
  hash: string;
  link: string;
  validadeEm: string;
  titulo: string;
  clienteNome: string;
  clienteTelefone: string | null;
  prestadorNome: string;
  valorCentavos: number | null;
};

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

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

export function telefoneWhatsApp(telefone: string | null | undefined): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

export function urlWhatsApp(telefone: string | null | undefined, mensagem: string): string {
  return `https://wa.me/${telefoneWhatsApp(telefone) ?? ""}?text=${encodeURIComponent(mensagem)}`;
}
