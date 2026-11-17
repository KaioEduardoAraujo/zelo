const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCurrency(value: number): string {
  // Intl usa espaço não separável depois de R$.
  return brl.format(value).replace(/\u00a0/g, " ");
}

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

export function formatDateTime(date: Date | string): string {
  return dateTime.format(new Date(date)).replace(",", "");
}

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

export function formatTime(date: Date | string): string {
  return time.format(new Date(date));
}

export function maskEmail(email: string): string {
  const [usuario, dominio] = email.trim().split("@");
  if (!usuario || !dominio) return "***";
  return `${usuario[0]}***@${dominio}`;
}
