import { z } from "zod";

import { isValidCpf } from "@/lib/validation/cpf";

/*
 * Formulário do cliente na página pública. Validado no navegador (resposta rápida) e de novo
 * no servidor (a entrada nunca é confiável).
 *
 * As regras de cada campo ficam TODAS no superRefine, de propósito: no Zod, se um campo da base
 * falha, os refinamentos não rodam, e a pessoa corrigiria um erro só para descobrir o próximo.
 * Assim, nome, CPF, comentário e consentimento são apontados juntos.
 */
export const respostaSchema = z
  .object({
    acao: z.enum(["aceito", "recusado", "ajuste"]),
    nome: z.string().trim(),
    /** Só dígitos. Obrigatório apenas no aceite. */
    cpf: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .optional(),
    comentario: z.string().trim().optional(),
    consentimento: z.boolean(),
  })
  .superRefine((d, ctx) => {
    const erro = (campo: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [campo], message });

    if (d.nome.length < 3) erro("nome", "Informe seu nome completo.");
    else if (d.nome.length > 120) erro("nome", "Nome longo demais.");

    if (d.acao === "aceito" && !(d.cpf && isValidCpf(d.cpf)))
      erro("cpf", "Confira o CPF: os números não batem.");

    const comentario = d.comentario ?? "";
    if (comentario.length > 2000) erro("comentario", "Use no máximo 2.000 caracteres.");
    else if (d.acao === "ajuste" && comentario.length < 5)
      erro("comentario", "Conte o que você gostaria de mudar.");

    if (d.consentimento !== true) erro("consentimento", "Marque a caixa para confirmar.");
  });

export type RespostaEntrada = z.input<typeof respostaSchema>;
export type RespostaValida = z.output<typeof respostaSchema>;

export const codigoSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "O código tem 6 números.");
