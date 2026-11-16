/* Formatação para a interface em pt-BR (DESIGN.md, seção 4). */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 8400 → "R$ 8.400,00" */
export function formatCurrency(value: number): string {
  // Intl usa espaço não separável depois de "R$"; normalizamos para espaço comum.
  return brl.format(value).replace(/\u00a0/g, " ");
}

/** Valores do banco estão em centavos: 840000 → "R$ 8.400,00" */
export function formatCentavos(centavos: number): string {
  return formatCurrency(centavos / 100);
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** Data e hora no formato dd/MM/yyyy HH:mm, no fuso de Brasília. */
export function formatDateTime(date: Date | string): string {
  return dateTime.format(new Date(date)).replace(",", "");
}

/**
 * Mascara o CPF para exibição (LGPD): "123.456.789-09" → "***.456.789-**".
 * Aceita com ou sem pontuação. Se não tiver 11 dígitos, devolve tudo mascarado.
 */
export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return "***.***.***-**";
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}
