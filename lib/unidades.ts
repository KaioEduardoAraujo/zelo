/*
 * Unidades de medida dos itens da proposta. `valor` é o que fica gravado no documento (máx. 10
 * caracteres, regra do schema); `rotulo` é só o que aparece no seletor.
 * Dúzia, dezena, centena e milhar mostram quantas unidades representam, para não haver dúvida.
 */
export const UNIDADES: { valor: string; rotulo: string }[] = [
  { valor: "un", rotulo: "un" },
  { valor: "vb", rotulo: "vb (verba)" },
  { valor: "m", rotulo: "m" },
  { valor: "m²", rotulo: "m²" },
  { valor: "m³", rotulo: "m³" },
  { valor: "kg", rotulo: "kg" },
  { valor: "h", rotulo: "h" },
  { valor: "dia", rotulo: "dia" },
  { valor: "mês", rotulo: "mês" },
  { valor: "dúzia", rotulo: "dúzia (12)" },
  { valor: "dezena", rotulo: "dezena (10)" },
  { valor: "centena", rotulo: "centena (100)" },
  { valor: "milhar", rotulo: "milhar (1.000)" },
];

/** Valor interno da opção que abre o campo de texto livre. Nunca é gravado. */
export const UNIDADE_OUTRA = "__outra__";
