import type { z } from "zod";

/**
 * Converte os erros do Zod em { "caminho.do.campo": "primeira mensagem" }.
 * Ex.: itens[2].descricao → "itens.2.descricao". Permite mostrar cada erro abaixo do campo certo,
 * inclusive dentro de listas (itens, exclusões).
 */
export function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "form";
    out[key] ??= issue.message;
  }
  return out;
}
