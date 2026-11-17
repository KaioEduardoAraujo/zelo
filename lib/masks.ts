export const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

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

// Cada dígito entra pela direita: "123" → R$ 1,23.
export function parseMoneyInput(value: string): number {
  const d = onlyDigits(value).replace(/^0+/, "").slice(0, 10);
  return Math.min(Number(d || "0"), 1_000_000_000);
}

export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(/\s/g, "");
  if (t === "") return null;
  let normalizado: string;
  if (t.includes(",")) {
    normalizado = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    normalizado = t.replace(/\./g, ""); // 1.500 é mil e quinhentos
  } else {
    normalizado = t;
  }
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

const decimalFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function formatDecimal(n: number): string {
  return decimalFmt.format(n);
}
