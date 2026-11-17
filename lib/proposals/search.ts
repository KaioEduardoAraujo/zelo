import { z } from "zod";

import { STATUS_ORDER, type PropostaStatus } from "@/lib/status";

export const PAGE_SIZE = 15;

// Vírgula, parênteses e aspas têm significado no filtro do PostgREST; % e _ são curingas do LIKE.
export function limparBusca(texto: unknown): string {
  if (typeof texto !== "string") return "";
  return texto
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export type FiltrosListagem = {
  q: string;
  status: PropostaStatus | null;
  pagina: number;
};

const statusSchema = z.enum(STATUS_ORDER as [PropostaStatus, ...PropostaStatus[]]);

export function lerFiltros(params: Record<string, string | string[] | undefined>): FiltrosListagem {
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = statusSchema.safeParse(um(params.status));
  const pagina = Number.parseInt(um(params.pagina) ?? "1", 10);
  return {
    q: limparBusca(um(params.q)),
    status: status.success ? status.data : null,
    pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 10_000 ? pagina : 1,
  };
}

export function urlListagem(base: string, f: Partial<FiltrosListagem>): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.status) sp.set("status", f.status);
  if (f.pagina && f.pagina > 1) sp.set("pagina", String(f.pagina));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}
