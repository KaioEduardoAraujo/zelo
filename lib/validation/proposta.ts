import { z } from "zod";

/*
 * Estrutura do `conteudo` (jsonb) de proposta_versoes e templates.
 *
 * Valores em CENTAVOS (inteiros): evita erro de ponto flutuante (0,1 + 0,2) e deixa o
 * hash estável — 8400 é sempre 8400, nunca "8400.00" ou "8.4e3".
 */

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

export const itemSchema = z.object({
  descricao: texto(2, 200),
  /** Ex.: "un", "m²", "m", "h", "vb" (verba). */
  unidade: texto(1, 10),
  /** Até 2 casas decimais (ex.: 22,5 m²). */
  quantidade: z.number().positive().max(100_000).multipleOf(0.01, "Use no máximo 2 casas decimais"),
  valor_unitario_centavos: z.number().int().nonnegative().max(1_000_000_000),
});

export type Item = z.infer<typeof itemSchema>;

/** Total do item arredondado para centavos inteiros. */
export function totalItemCentavos(item: Pick<Item, "quantidade" | "valor_unitario_centavos">) {
  return Math.round(item.quantidade * item.valor_unitario_centavos);
}

export function totalCentavos(itens: Pick<Item, "quantidade" | "valor_unitario_centavos">[]) {
  return itens.reduce((soma, item) => soma + totalItemCentavos(item), 0);
}

const camposBase = {
  escopo: texto(10, 4000),
  itens: z.array(itemSchema).min(1).max(100),
  /** O que NÃO está incluso — destacado para o cliente (evita o "eu não pedi isso"). */
  exclusoes: z.array(texto(2, 300)).max(50),
  valor_total_centavos: z.number().int().nonnegative(),
  prazo: texto(3, 300),
  pagamento: texto(3, 500),
  garantia: texto(3, 500),
  observacoes: texto(0, 2000).optional(),
};

/** Conteúdo completo de uma versão pronta para envio. */
export const conteudoPropostaSchema = z
  .object(camposBase)
  .strict()
  .refine((c) => c.valor_total_centavos === totalCentavos(c.itens), {
    message: "O total precisa ser a soma dos itens",
    path: ["valor_total_centavos"],
  });

export type ConteudoProposta = z.infer<typeof conteudoPropostaSchema>;

/** Template = conteúdo sugerido + validade padrão em dias. */
export const conteudoTemplateSchema = z
  .object({ ...camposBase, validade_dias: z.number().int().min(1).max(90) })
  .strict()
  .refine((c) => c.valor_total_centavos === totalCentavos(c.itens), {
    message: "O total precisa ser a soma dos itens",
    path: ["valor_total_centavos"],
  });

export type ConteudoTemplate = z.infer<typeof conteudoTemplateSchema>;
