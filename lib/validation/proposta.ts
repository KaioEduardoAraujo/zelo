import { z } from "zod";

import { phoneSchema } from "@/lib/validation/auth";

/*
 * Estrutura do `conteudo` (jsonb) de proposta_versoes e templates.
 *
 * Valores em CENTAVOS (inteiros): evita erro de ponto flutuante (0,1 + 0,2) e deixa o
 * hash estável — 8400 é sempre 8400, nunca "8400.00" ou "8.4e3".
 *
 * Dois níveis de rigor:
 *  - ESTRITO (`conteudoPropostaSchema` e os schemas por etapa): exigido para avançar no
 *    assistente e para enviar. Mensagens em português, prontas para mostrar abaixo do campo.
 *  - LENIENTE (`conteudoRascunhoSchema`): usado ao SALVAR um rascunho. Nunca recusa um campo
 *    incompleto, porque o autosave não pode perder o que a pessoa digitou até agora.
 */

const texto = (min: number, max: number, mensagem: string) =>
  z.string().trim().min(min, mensagem).max(max, `Use no máximo ${max} caracteres.`);

export const VALIDADE_PADRAO_DIAS = 15;

/* ----------------------------- Estrito ----------------------------- */

export const itemSchema = z.object({
  descricao: texto(2, 200, "Descreva o item."),
  /** Ex.: "un", "m²", "m", "h", "vb" (verba). */
  unidade: texto(1, 10, "Informe a unidade."),
  /** Até 2 casas decimais (ex.: 22,5 m²). */
  quantidade: z
    .number("Informe a quantidade.")
    .positive("A quantidade precisa ser maior que zero.")
    .max(100_000, "Quantidade alta demais.")
    .multipleOf(0.01, "Use no máximo 2 casas decimais."),
  valor_unitario_centavos: z
    .number()
    .int()
    .nonnegative("O valor não pode ser negativo.")
    .max(1_000_000_000, "Valor alto demais."),
});

export type Item = z.infer<typeof itemSchema>;

/** Total do item arredondado para centavos inteiros. */
export function totalItemCentavos(item: Pick<Item, "quantidade" | "valor_unitario_centavos">) {
  return Math.round(item.quantidade * item.valor_unitario_centavos);
}

export function totalCentavos(itens: Pick<Item, "quantidade" | "valor_unitario_centavos">[]) {
  return itens.reduce((soma, item) => soma + totalItemCentavos(item), 0);
}

/** Etapa 2 do assistente: o que será feito. */
const escopoCampos = {
  escopo: texto(10, 4000, "Descreva o que será feito (pelo menos 10 caracteres)."),
  itens: z.array(itemSchema).min(1, "Inclua pelo menos um item.").max(100),
  /** O que NÃO está incluso — destacado para o cliente (evita o "eu não pedi isso"). */
  exclusoes: z.array(texto(2, 300, "Escreva a exclusão ou remova a linha.")).max(50),
};

/** Etapa 3 do assistente: quanto custa, em quanto tempo e como se paga. */
const valoresCampos = {
  valor_total_centavos: z.number().int().positive("Informe o valor de pelo menos um item."),
  prazo: texto(3, 300, "Informe o prazo."),
  pagamento: texto(3, 500, "Informe a forma de pagamento."),
  garantia: texto(3, 500, "Informe a garantia (ou escreva “Sem garantia”)."),
  /** Por quantos dias a proposta vale depois de enviada. Vira `validade_em` no envio. */
  validade_dias: z
    .number("Informe a validade em dias.")
    .int("Use um número inteiro de dias.")
    .min(1, "A validade mínima é de 1 dia.")
    .max(90, "A validade máxima é de 90 dias."),
  observacoes: texto(0, 2000, "").optional(),
};

const somaConfere = (c: {
  valor_total_centavos: number;
  itens: Parameters<typeof totalCentavos>[0];
}) => c.valor_total_centavos === totalCentavos(c.itens);

export const escopoEtapaSchema = z.object(escopoCampos);
export const valoresEtapaSchema = z.object(valoresCampos);

/** Conteúdo completo de uma versão pronta para envio. Template = o mesmo formato. */
export const conteudoPropostaSchema = z
  .object({ ...escopoCampos, ...valoresCampos })
  .strict()
  .refine(somaConfere, {
    message: "O total precisa ser a soma dos itens",
    path: ["valor_total_centavos"],
  });

export type ConteudoProposta = z.infer<typeof conteudoPropostaSchema>;

export const conteudoTemplateSchema = conteudoPropostaSchema;
export type ConteudoTemplate = ConteudoProposta;

/** Dados do cliente e título (colunas de `propostas`, não do conteúdo). */
export const clienteSchema = z.object({
  nome: texto(2, 120, "Informe o nome do cliente."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Informe o e-mail do cliente.")
    .max(254, "E-mail longo demais.")
    .pipe(z.email("Confira o e-mail: parece que falta alguma parte.")),
  /** Opcional. Só dígitos, com DDD. Usado para montar o link do WhatsApp. */
  telefone: phoneSchema,
  titulo: texto(3, 140, "Dê um título à proposta (pelo menos 3 letras)."),
});

export type Cliente = z.input<typeof clienteSchema>;

/* ----------------------------- Leniente ---------------------------- */

/**
 * Rascunho: aceita campo vazio, em qualquer etapa, e preenche o que faltar com um padrão.
 * Chaves desconhecidas são DESCARTADAS (Zod remove por padrão): o jsonb que vai para o banco —
 * e depois para o hash — só contém os campos que conhecemos.
 */
export const conteudoRascunhoSchema = z.object({
  escopo: z.string().max(4000).default(""),
  itens: z
    .array(
      z.object({
        descricao: z.string().max(200).default(""),
        unidade: z.string().max(10).default("un"),
        quantidade: z.number().min(0).max(100_000).default(1),
        valor_unitario_centavos: z.number().int().min(0).max(1_000_000_000).default(0),
      }),
    )
    .max(100)
    .default([]),
  exclusoes: z.array(z.string().max(300)).max(50).default([]),
  prazo: z.string().max(300).default(""),
  pagamento: z.string().max(500).default(""),
  garantia: z.string().max(500).default(""),
  validade_dias: z.number().int().min(1).max(90).default(VALIDADE_PADRAO_DIAS),
  observacoes: z.string().max(2000).optional(),
});

export type ConteudoRascunhoEntrada = z.input<typeof conteudoRascunhoSchema>;

/** Conteúdo de rascunho já normalizado, com o total calculado. */
export type ConteudoRascunho = {
  escopo: string;
  itens: {
    descricao: string;
    unidade: string;
    quantidade: number;
    valor_unitario_centavos: number;
  }[];
  exclusoes: string[];
  valor_total_centavos: number;
  prazo: string;
  pagamento: string;
  garantia: string;
  validade_dias: number;
  observacoes?: string;
};
