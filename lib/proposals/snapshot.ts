export type SnapshotDocumento = {
  titulo: string;
  prestador: { nome: string; empresa: string | null };
  cliente: { nome: string; email: string; telefone: string | null };
  referencia?: { proposta_id: string; titulo: string; hash_documento: string };
};

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown) => (typeof v === "string" ? v : "");
const textoOuNulo = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

export function lerSnapshot(bruto: unknown): SnapshotDocumento | null {
  if (!ehObjeto(bruto) || !ehObjeto(bruto.prestador) || !ehObjeto(bruto.cliente)) return null;
  const ref = ehObjeto(bruto.referencia) ? bruto.referencia : null;
  return {
    ...(ref && texto(ref.proposta_id) && texto(ref.hash_documento)
      ? {
          referencia: {
            proposta_id: texto(ref.proposta_id),
            titulo: texto(ref.titulo),
            hash_documento: texto(ref.hash_documento),
          },
        }
      : {}),
    titulo: texto(bruto.titulo),
    prestador: { nome: texto(bruto.prestador.nome), empresa: textoOuNulo(bruto.prestador.empresa) },
    cliente: {
      nome: texto(bruto.cliente.nome),
      email: texto(bruto.cliente.email),
      telefone: textoOuNulo(bruto.cliente.telefone),
    },
  };
}
