// Serialização determinística: chaves em ordem alfabética, sem espaços. É o mesmo formato que o
// Postgres devolve do jsonb, então o hash recalculado bate. O que não é JSON é recusado.
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
