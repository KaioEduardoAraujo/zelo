/** Retrato das partes gravado no documento no momento do envio (decisão D24). */
export type SnapshotDocumento = {
  titulo: string;
  prestador: { nome: string; empresa: string | null };
  cliente: { nome: string; email: string; telefone: string | null };
};

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown) => (typeof v === "string" ? v : "");
const textoOuNulo = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

/** Extrai o retrato das partes do jsonb bruto de uma versão enviada (null se não houver). */
export function lerSnapshot(bruto: unknown): SnapshotDocumento | null {
  if (!ehObjeto(bruto) || !ehObjeto(bruto.prestador) || !ehObjeto(bruto.cliente)) return null;
  return {
    titulo: texto(bruto.titulo),
    prestador: { nome: texto(bruto.prestador.nome), empresa: textoOuNulo(bruto.prestador.empresa) },
    cliente: {
      nome: texto(bruto.cliente.nome),
      email: texto(bruto.cliente.email),
      telefone: textoOuNulo(bruto.cliente.telefone),
    },
  };
}
