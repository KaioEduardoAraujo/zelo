// Caracteres que as fontes embutidas desenham. O resto é adaptado só no PDF: o documento
// guardado (e o hash) continua igual.
const SUPORTADOS: [number, number][] = [
  [0x0a, 0x0a],
  [0x0d, 0x0d],
  [0x20, 0x7e],
  [0xa0, 0xff],
  [0x102, 0x102],
  [0x131, 0x131],
  [0x152, 0x153],
  [0x2c6, 0x2c6],
  [0x2da, 0x2da],
  [0x2dc, 0x2dc],
  [0x2013, 0x2014],
  [0x2018, 0x201a],
  [0x201c, 0x201e],
  [0x2022, 0x2022],
  [0x2026, 0x2026],
  [0x2039, 0x203a],
  [0x2044, 0x2044],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
];

const TROCAS: Record<string, string> = {
  "\t": " ",
  "≈": "~",
  "→": "->",
  "←": "<-",
  "≤": "<=",
  "≥": ">=",
  "≠": "!=",
  "✓": "v",
  "✔": "v",
  " ": "\n",
  " ": "\n",
};

const suportado = (cp: number) => SUPORTADOS.some(([a, b]) => cp >= a && cp <= b);

export function paraFontePdf(texto: string): string {
  let saida = "";
  for (const ch of texto) {
    const cp = ch.codePointAt(0)!;
    if (suportado(cp)) {
      saida += ch;
      continue;
    }
    if (ch in TROCAS) {
      saida += TROCAS[ch];
      continue;
    }
    if (/[​-‍︎️̀-ͯ]/u.test(ch)) continue;
    const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    if (base && [...base].every((c) => suportado(c.codePointAt(0)!))) {
      saida += base;
      continue;
    }
    saida += "?";
  }
  return saida;
}

export function sanitizarParaPdf<T>(valor: T): T {
  if (typeof valor === "string") return paraFontePdf(valor) as T;
  if (Array.isArray(valor)) return valor.map(sanitizarParaPdf) as T;
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, sanitizarParaPdf(v)])) as T;
  }
  return valor;
}
