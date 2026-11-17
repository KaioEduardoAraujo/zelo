import Link from "next/link";

import { StatusBadge } from "@/components/zelo/status-badge";
import { formatCentavos, formatRelative } from "@/lib/format";
import type { PropostaStatus } from "@/lib/status";
import { textosDe, type TipoDocumento } from "@/lib/tipos";

export type ProposalSummary = {
  id: string;
  /** Aditivo e entrega aparecem com um rótulo; proposta (o padrão) não. */
  tipo?: TipoDocumento;
  titulo: string;
  clienteNome: string;
  valorCentavos: number | null;
  status: PropostaStatus;
  /** Data da última movimentação (criação, envio ou resposta). */
  atualizadoEm: string;
};

/**
 * Cartão de proposta da listagem no mobile (DESIGN.md 6): cliente, título, valor em destaque,
 * status e data relativa. O cartão inteiro é o link (alvo de toque grande).
 */
export function ProposalCard({ proposal, now }: { proposal: ProposalSummary; now?: Date }) {
  return (
    <Link
      href={`/propostas/${proposal.id}`}
      className="block min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-hairline)] transition-colors duration-150 hover:border-line-strong focus-visible:outline-2"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-support text-slate-600">
          {proposal.tipo && proposal.tipo !== "proposta" && (
            <span className="mr-1.5 font-semibold text-navy-700">
              {textosDe(proposal.tipo).rotulo} ·
            </span>
          )}
          {proposal.clienteNome}
        </p>
        <StatusBadge status={proposal.status} />
      </div>
      <p className="mt-1 line-clamp-2 text-h3 break-words text-navy-950">{proposal.titulo}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="tabular text-h2 text-navy-900">
          {proposal.valorCentavos === null ? (
            <span className="text-support text-slate-600">
              {proposal.tipo === "entrega" ? "Registro de entrega" : "Sem valor ainda"}
            </span>
          ) : (
            formatCentavos(proposal.valorCentavos)
          )}
        </p>
        <time dateTime={proposal.atualizadoEm} className="shrink-0 text-support text-slate-600">
          {formatRelative(proposal.atualizadoEm, now)}
        </time>
      </div>
    </Link>
  );
}
