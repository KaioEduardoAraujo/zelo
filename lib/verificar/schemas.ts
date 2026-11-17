import { z } from "zod";

// O arquivo não sai do navegador: só o SHA-256 dele chega aqui.
export const ALFABETO_CODIGO = "[2-9A-Z]"; // sem 0 e 1, que se confundem com O e I

export function normalizarCodigo(bruto: string): string {
  const limpo = bruto.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const semPrefixo = limpo.startsWith("ZL") ? limpo.slice(2) : limpo;
  if (semPrefixo.length !== 8) return bruto.trim().toUpperCase();
  return `ZL-${semPrefixo.slice(0, 4)}-${semPrefixo.slice(4)}`;
}

export const verificacaoSchema = z.object({
  codigo: z
    .string()
    .max(40)
    .transform(normalizarCodigo)
    .pipe(
      z
        .string()
        .regex(
          new RegExp(`^ZL-${ALFABETO_CODIGO}{4}-${ALFABETO_CODIGO}{4}$`),
          "Confira o código: ele tem o formato ZL-XXXX-XXXX.",
        ),
    ),
  arquivoSha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .optional(),
});
