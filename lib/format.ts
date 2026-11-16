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

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "agora", "há 5 minutos", "ontem", "há 2 semanas", "em 3 dias". */
export function formatRelative(date: Date | string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(date).getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.trunc(seconds / size), unit);
  }
  return "agora";
}

const time = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** Só a hora, no fuso de Brasília: "14:32". */
export function formatTime(date: Date | string): string {
  return time.format(new Date(date));
}

/**
 * Mascara o e-mail para exibição (LGPD): "mariana.costa@example.com" → "m***@example.com".
 * Quem tem o link vê para onde o código vai, sem ver o endereço inteiro.
 */
export function maskEmail(email: string): string {
  const [usuario, dominio] = email.trim().split("@");
  if (!usuario || !dominio) return "***";
  return `${usuario[0]}***@${dominio}`;
}
