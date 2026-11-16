import type { PropostaStatus } from "@/lib/status";

/*
 * "Precisa de atenção" no painel: o que depende de uma ação do prestador agora.
 *  - o cliente pediu ajuste (só o prestador pode responder);
 *  - o cliente abriu a proposta e ainda não respondeu;
 *  - a proposta está perto de vencer sem resposta.
 */

export const DIAS_PERTO_DE_VENCER = 3;

export type AttentionInput = {
  status: PropostaStatus;
  validadeEm: string | null;
};

export type Attention = { motivo: string; urgencia: "alta" | "media" };

const DIA_MS = 24 * 60 * 60 * 1000;

export function atencao(p: AttentionInput, agora: Date = new Date()): Attention | null {
  const validade = p.validadeEm ? new Date(p.validadeEm).getTime() : null;
  const aberta = p.status === "enviada" || p.status === "visualizada";
  const vencida = validade !== null && validade < agora.getTime();
  if (vencida) return null; // expirada: não há mais o que esperar do cliente

  if (p.status === "ajuste_solicitado") {
    return { motivo: "O cliente pediu ajuste", urgencia: "alta" };
  }

  if (aberta && validade !== null) {
    const dias = Math.ceil((validade - agora.getTime()) / DIA_MS);
    if (dias <= DIAS_PERTO_DE_VENCER) {
      const quando = dias <= 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`;
      return { motivo: `Vence ${quando}, sem resposta`, urgencia: "alta" };
    }
  }

  if (p.status === "visualizada") {
    return { motivo: "O cliente abriu e ainda não respondeu", urgencia: "media" };
  }
  return null;
}
