import type { Enums } from "@/lib/supabase/database.types";

export type PropostaStatus = Enums<"proposta_status">;
export type EventoTipo = Enums<"evento_tipo">;

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/** Rótulo e tom de cada status (DESIGN.md 3.2 e 6). A ordem é a dos filtros da listagem. */
export const STATUS: Record<PropostaStatus, { label: string; tone: Tone }> = {
  rascunho: { label: "Rascunho", tone: "neutral" },
  enviada: { label: "Enviada", tone: "info" },
  visualizada: { label: "Visualizada", tone: "info" },
  ajuste_solicitado: { label: "Pediu ajuste", tone: "warning" },
  aceita: { label: "Aceita", tone: "success" },
  recusada: { label: "Recusada", tone: "danger" },
  expirada: { label: "Expirada", tone: "neutral" },
};

export const STATUS_ORDER = Object.keys(STATUS) as PropostaStatus[];

/** Texto de cada evento da trilha de auditoria, do ponto de vista do prestador. */
export const EVENTO: Record<EventoTipo, string> = {
  enviada: "Proposta enviada",
  link_regenerado: "Novo link gerado",
  aberta: "Cliente abriu a proposta",
  otp_enviado: "Código enviado por e-mail",
  otp_verificado: "Código confirmado",
  otp_falhou: "Código incorreto",
  aceita: "Proposta aceita",
  recusada: "Proposta recusada",
  ajuste_solicitado: "Cliente pediu ajuste",
  pdf_gerado: "Comprovante gerado",
  email_enviado: "Comprovante enviado por e-mail",
};
