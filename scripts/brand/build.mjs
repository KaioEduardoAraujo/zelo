// Gera os arquivos de marca da Zelo a partir de uma reconstrução geométrica do símbolo:
// public/brand/{symbol,logo,logo-negativo}.svg, app/icon.svg, app/apple-icon.png, app/favicon.ico.
//
// Ferramenta avulsa (as dependências NÃO fazem parte do app). Para rodar:
//   mkdir /tmp/brandtool && cp scripts/brand/build.mjs /tmp/brandtool && cd /tmp/brandtool
//   npm init -y && npm i @resvg/resvg-js opentype.js png-to-ico @fontsource/manrope
//   node build.mjs "<caminho-do-projeto>"
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import opentype from "opentype.js";
import pngToIco from "png-to-ico";

const out = process.argv[2];
const NAVY = "#1A3349";
const TEAL = "#38A095";
const BG = "#F1F5F5";

// Geometria (viewBox 0 0 100 100, centro 50,50). Todos os traços com a mesma espessura.
// Anel: raio médio 40.5, espessura 9 (externo 45, interno 36).
// Check: vértice (48,58); braço longo a 45° até a borda externa do anel; braço curto a 45°.
// Diagonal do Z: paralela ao braço longo, deslocada 12 unidades para baixo/esquerda.
// Os "cortes" (respiros) são feitos com <mask>, por isso ficam paralelos às diagonais,
// como no desenho original.
const W = 9;
const GAP = 3;
const CHECK = "M38 48 L48 58 L84.68 21.32";
const CHECK_KO = "M38 48 L48 58 L92 14"; // estendido para atravessar o anel
const ZDIAG = "M34.2 54.8 L13.16 75.84";
const ZDIAG_KO = "M34.2 54.8 L6 83";
const ZTOP = "M27 44 V40 Q27 28 39 28 H80";
const ZBOTTOM = "M17 72 H60 Q71 72 71 61 V55";
const RING = "M50 9.5 A40.5 40.5 0 1 1 49.99 9.5 Z";

function symbol({ navy = NAVY, teal = TEAL, id = "z", simplified = false } = {}) {
  const ko = W + GAP * 2;
  const masks = `
  <defs>
    <clipPath id="${id}-ul"><path d="M-10 -10 H107 L-10 107 Z"/></clipPath>
    <clipPath id="${id}-lr"><path d="M110 110 H-7 L110 -7 Z"/></clipPath>
    <mask id="${id}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <rect width="100" height="100" fill="#fff"/>
      <path d="${CHECK_KO}" fill="none" stroke="#000" stroke-width="${ko}" stroke-linejoin="round"/>
      ${simplified ? "" : `<path d="${ZDIAG_KO}" fill="none" stroke="#000" stroke-width="${ko}"/>`}
    </mask>
  </defs>`;
  // Linha divisória entre as metades do anel: x + y = 97 (fica escondida nos respiros).
  const ring = `
  <g mask="url(#${id}-m)" fill="none" stroke-width="${W}">
    <path d="${RING}" stroke="${navy}" clip-path="url(#${id}-ul)"/>
    <path d="${RING}" stroke="${teal}" clip-path="url(#${id}-lr)"/>
    ${simplified ? "" : `<path d="${ZTOP}" stroke="${navy}"/>`}
  </g>`;
  const z = simplified
    ? ""
    : `<g fill="none" stroke="${navy}" stroke-width="${W}"><path d="${ZDIAG}"/><path d="${ZBOTTOM}"/></g>`;
  const check = `<path d="${CHECK}" fill="none" stroke="${teal}" stroke-width="${W}" stroke-linejoin="miter"/>`;
  return `${masks}${ring}${z}${check}`;
}

const svg = (vb, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;

// Wordmark "zelo" em Manrope ExtraBold, convertido em curvas (não depende da fonte instalada).
const fontBuf = fs.readFileSync(
  path.resolve("node_modules/@fontsource/manrope/files/manrope-latin-800-normal.woff"),
);
const font = opentype.parse(
  fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength),
);
function wordmark(color, x0) {
  const probe = font.getPath("l", 0, 0, 100).getBoundingBox(); // altura do "l" em size 100
  const xprobe = font.getPath("o", 0, 0, 100).getBoundingBox();
  const lHeight = -probe.y1;
  const size = (54 / lHeight) * 100; // ascendente = 60% do diâmetro do símbolo (90)
  const xHeight = (-xprobe.y1 * size) / 100;
  const baseline = 50 + xHeight / 2; // altura-x centralizada no símbolo
  const p = font.getPath("zelo", x0, baseline, size, { letterSpacing: -0.02 });
  const bb = p.getBoundingBox();
  return { d: p.toPathData(2), width: bb.x2, color };
}

function logo({ negative = false, id }) {
  const navy = negative ? "#FFFFFF" : NAVY;
  const wm = wordmark(navy, 109);
  const w = Math.ceil(wm.width + 5);
  return svg(`0 0 ${w} 100`, symbol({ navy, id }) + `<path d="${wm.d}" fill="${navy}"/>`, "Zelo");
}

const brandDir = path.join(out, "public/brand");
fs.mkdirSync(brandDir, { recursive: true });
const files = {
  [path.join(brandDir, "symbol.svg")]: svg("0 0 100 100", symbol({ id: "zs" }), "Zelo"),
  [path.join(brandDir, "logo.svg")]: logo({ id: "zl" }),
  [path.join(brandDir, "logo-negativo.svg")]: logo({ negative: true, id: "zn" }),
  [path.join(out, "app/icon.svg")]: svg(
    "0 0 100 100",
    symbol({ id: "zi", simplified: true }),
    "Zelo",
  ),
};
for (const [f, c] of Object.entries(files)) fs.writeFileSync(f, c);

const render = (svgStr, width, background) =>
  new Resvg(svgStr, { fitTo: { mode: "width", value: width }, background }).render().asPng();

// apple-icon: símbolo completo com respiro, sobre o fundo da marca.
const apple = svg(
  "-14 -14 128 128",
  `<rect x="-14" y="-14" width="128" height="128" fill="${BG}"/>` + symbol({ id: "za" }),
  "Zelo",
);
fs.writeFileSync(path.join(out, "app/apple-icon.png"), render(apple, 180));

// favicon.ico: versão simplificada (anel + check) em 16, 32 e 48px.
const icon = svg("0 0 100 100", symbol({ id: "zf", simplified: true }), "Zelo");
const icoPngs = [16, 32, 48].map((s) => render(icon, s));
fs.writeFileSync(path.join(out, "app/favicon.ico"), await pngToIco(icoPngs));

// Prévias para conferência visual (scratchpad).
const prev = path.resolve("preview");
fs.mkdirSync(prev, { recursive: true });
fs.writeFileSync(
  path.join(prev, "symbol.png"),
  render(files[path.join(brandDir, "symbol.svg")], 600, BG),
);
fs.writeFileSync(
  path.join(prev, "logo.png"),
  render(files[path.join(brandDir, "logo.svg")], 1200, BG),
);
fs.writeFileSync(
  path.join(prev, "logo-neg.png"),
  render(files[path.join(brandDir, "logo-negativo.svg")], 1200, "#12263A"),
);
[16, 32, 64].forEach((s) =>
  fs.writeFileSync(path.join(prev, `icon-${s}.png`), render(icon, s, "#FFFFFF")),
);
console.log("ok");
