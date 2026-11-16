import {
  clienteSchema,
  conteudoPropostaSchema,
  escopoEtapaSchema,
  totalCentavos,
  VALIDADE_PADRAO_DIAS,
  valoresEtapaSchema,
  type Cliente,
  type ConteudoRascunho,
} from "@/lib/validation/proposta";
import { flattenIssues } from "@/lib/validation/errors";

/*
 * Lógica pura dos rascunhos (sem banco, sem React): roda no servidor, no navegador e nos testes.
 */

export type Etapa = 1 | 2 | 3 | 4;

export const ETAPAS: { numero: Etapa; titulo: string; curto: string }[] = [
  { numero: 1, titulo: "Cliente e título", curto: "Cliente" },
  { numero: 2, titulo: "Escopo e itens", curto: "Escopo" },
  { numero: 3, titulo: "Valores, prazo e pagamento", curto: "Valores" },
  { numero: 4, titulo: "Revisar", curto: "Revisar" },
];

/** Estado do formulário inteiro (dados do cliente + conteúdo da versão). */
export type DraftForm = {
  clienteNome: string;
  clienteEmail: string;
  /** Só dígitos, com DDD. */
  clienteTelefone: string;
  titulo: string;
  conteudo: ConteudoRascunho;
};

export function conteudoVazio(): ConteudoRascunho {
  return {
    escopo: "",
    itens: [],
    exclusoes: [],
    valor_total_centavos: 0,
    prazo: "",
    pagamento: "",
    garantia: "",
    validade_dias: VALIDADE_PADRAO_DIAS,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown, padrao: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : padrao;

/**
 * Normaliza o conteúdo (vindo do navegador, do banco ou de um template) para o formato do
 * rascunho: apara textos, descarta exclusões vazias, limita a quantidade a 2 casas e RECALCULA
 * o total a partir dos itens — o total que vem de fora nunca é confiável.
 *
 * É TOLERANTE de propósito: um campo fora do limite não pode fazer o resto sumir (o autosave
 * apagaria o trabalho da pessoa). Com `manterExclusoesVazias`, linhas em branco continuam na lista:
 * usado só para validar, para que o índice do erro bata com a linha que a pessoa vê na tela.
 * Os limites são cobrados pela validação (que mostra a mensagem
 * no campo) e pelo servidor (que recusa gravar em vez de truncar). Chaves desconhecidas são
 * descartadas: o jsonb gravado, e depois o hash, só contém os campos conhecidos.
 */
export function normalizarConteudo(
  entrada: unknown,
  manterExclusoesVazias = false,
): ConteudoRascunho {
  const raw = isRecord(entrada) ? entrada : {};

  const itens = (Array.isArray(raw.itens) ? raw.itens : []).filter(isRecord).map((item) => ({
    descricao: str(item.descricao),
    unidade: str(item.unidade),
    quantidade: Math.round(num(item.quantidade, 1) * 100) / 100,
    valor_unitario_centavos: Math.round(num(item.valor_unitario_centavos, 0)),
  }));

  const observacoes = str(raw.observacoes);
  return {
    escopo: str(raw.escopo),
    itens,
    exclusoes: (Array.isArray(raw.exclusoes) ? raw.exclusoes : [])
      .map(str)
      .filter((e) => manterExclusoesVazias || e !== ""),
    valor_total_centavos: totalCentavos(itens),
    prazo: str(raw.prazo),
    pagamento: str(raw.pagamento),
    garantia: str(raw.garantia),
    validade_dias: num(raw.validade_dias, VALIDADE_PADRAO_DIAS),
    ...(observacoes ? { observacoes } : {}),
  };
}

type Erros = Record<string, string>;

const dadosCliente = (f: DraftForm): Cliente => ({
  nome: f.clienteNome,
  email: f.clienteEmail,
  telefone: f.clienteTelefone,
  titulo: f.titulo,
});

/** Erros por campo de cada etapa (vazio = pode avançar). */
export function validarEtapa(etapa: Etapa, form: DraftForm): Erros {
  const conteudo = normalizarConteudo(form.conteudo, true);
  if (etapa === 1) {
    const r = clienteSchema.safeParse(dadosCliente(form));
    return r.success ? {} : prefixar("cliente", flattenIssues(r.error));
  }
  if (etapa === 2) {
    const r = escopoEtapaSchema.safeParse(conteudo);
    return r.success ? {} : flattenIssues(r.error);
  }
  if (etapa === 3) {
    const r = valoresEtapaSchema.safeParse(conteudo);
    return r.success ? {} : flattenIssues(r.error);
  }
  return validarTudo(form);
}

/** Validação completa (etapa 4 e envio): cliente + conteúdo no formato estrito. */
export function validarTudo(form: DraftForm): Erros {
  const erros: Erros = {};
  const cliente = clienteSchema.safeParse(dadosCliente(form));
  if (!cliente.success) Object.assign(erros, prefixar("cliente", flattenIssues(cliente.error)));
  const conteudo = conteudoPropostaSchema.safeParse(normalizarConteudo(form.conteudo));
  if (!conteudo.success) Object.assign(erros, flattenIssues(conteudo.error));
  return erros;
}

/** Validação do editor de modelos: nome + conteúdo completo (um modelo nasce pronto para usar). */
export function validarModelo(titulo: string, conteudo: ConteudoRascunho): Erros {
  const erros: Erros = {};
  const nome = titulo.trim();
  if (nome.length < 3) erros.titulo = "Dê um nome ao modelo (pelo menos 3 letras).";
  else if (nome.length > 120) erros.titulo = "Use no máximo 120 caracteres.";
  const r = conteudoPropostaSchema.safeParse(normalizarConteudo(conteudo, true));
  if (!r.success) Object.assign(erros, flattenIssues(r.error));
  return erros;
}

/** Em qual etapa o assistente deve abrir para corrigir um erro. */
export function etapaDoCampo(campo: string): Etapa {
  if (campo.startsWith("cliente.")) return 1;
  if (campo.startsWith("escopo") || campo.startsWith("itens") || campo.startsWith("exclusoes")) {
    // Itens têm campos nas duas etapas: descrição/unidade/quantidade na 2, valor na 3.
    return campo.endsWith("valor_unitario_centavos") ? 3 : 2;
  }
  return 3;
}

function prefixar(prefixo: string, erros: Erros): Erros {
  return Object.fromEntries(Object.entries(erros).map(([k, v]) => [`${prefixo}.${k}`, v]));
}
