/*
 * Serialização CANÔNICA de um valor JSON (regra inegociável nº 2).
 *
 * O hash de um documento só serve como prova se qualquer pessoa, em qualquer momento, chegar ao
 * MESMO texto a partir do MESMO conteúdo. Por isso a serialização é determinística:
 *   - chaves de objeto em ordem alfabética (recursivamente);
 *   - sem espaços nem quebras de linha;
 *   - listas mantêm a ordem (a ordem dos itens faz parte do documento);
 *   - texto e números seguem o JSON padrão (JSON.stringify), que é o mesmo formato que o banco
 *     devolve ao ler o jsonb, por isso o hash recalculado depois do envio continua batendo.
 *
 * Só aceita JSON puro: undefined em propriedade de objeto é omitido (como no JSON), mas qualquer
 * outra coisa que não seja JSON (função, Date, NaN, Infinity…) é recusada, em vez de virar um
 * hash silenciosamente diferente.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new Error("Número inválido na serialização canônica");
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) {
        return `[${value.map((item) => (item === undefined ? "null" : canonicalize(item))).join(",")}]`;
      }
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new Error("Só objetos simples entram na serialização canônica");
      }
      const objeto = value as Record<string, unknown>;
      const partes = Object.keys(objeto)
        .filter((chave) => objeto[chave] !== undefined)
        .sort()
        .map((chave) => `${JSON.stringify(chave)}:${canonicalize(objeto[chave])}`);
      return `{${partes.join(",")}}`;
    }
    default:
      throw new Error(`Tipo não suportado na serialização canônica: ${typeof value}`);
  }
}
