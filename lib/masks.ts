/*
 * Máscaras de digitação (DESIGN.md 6: "máscaras para CPF, telefone e valor").
 * Funções puras: recebem o texto digitado e devolvem o texto formatado.
 * O valor enviado ao servidor é sempre só dígitos (ou centavos); o servidor revalida com Zod.
 */

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** 12345678909 → 123.456.789-09 (formata enquanto digita). */
export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** 11987654321 → (11) 98765-4321 · 1134567890 → (11) 3456-7890 */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  const split = d.length === 11 ? 5 : 4;
  if (rest.length <= split) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/**
 * Dinheiro estilo "caixa registradora": cada dígito entra pela direita.
 * "1" → 1 centavo, "123" → R$ 1,23. Devolve centavos (inteiro), limitado a R$ 10 milhões.
 */
export function parseMoneyInput(value: string): number {
  const d = onlyDigits(value).replace(/^0+/, "").slice(0, 10);
  return Math.min(Number(d || "0"), 1_000_000_000);
}
