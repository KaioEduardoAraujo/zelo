import { formatCentavos } from "@/lib/format";
import type { AcaoCliente } from "@/lib/publico/otp";
import type { TipoDocumento } from "@/lib/tipos";

/*
 * Texto de consentimento (DESIGN.md 8 e LGPD): claro, em primeira pessoa, com a FINALIDADE dos
 * dados. É montado no servidor e gravado no aceite exatamente como foi mostrado.
 * Os textos da PROPOSTA são os da Fase 6; aditivo e entrega só trocam o objeto da frase.
 */
export function textoConsentimento(
  acao: AcaoCliente,
  p: {
    titulo: string;
    prestador: string;
    /** null na entrega (não tem valor). */
    valorCentavos: number | null;
    tipo?: TipoDocumento;
  },
): string {
  const tipo = p.tipo ?? "proposta";
  const registro =
    "Entendo que esta resposta fica registrada com data, hora e dispositivo, e que meu nome e meu e-mail são usados apenas para comprová-la.";

  if (tipo === "entrega") {
    const doc = `a entrega do serviço “${p.titulo}”, de ${p.prestador}`;
    if (acao === "aceito") {
      return (
        `Confirmo que recebi ${doc}, conforme o checklist e as fotos acima. ` +
        "Entendo que esta confirmação fica registrada com data, hora e dispositivo, e que meu nome, CPF e " +
        `e-mail são usados apenas para comprová-la entre mim e ${p.prestador}.`
      );
    }
    if (acao === "recusado") return `Recuso ${doc}. ${registro}`;
    return `Peço correção na entrega do serviço “${p.titulo}”, de ${p.prestador}, conforme o comentário acima. ${registro}`;
  }

  const objeto = tipo === "aditivo" ? "o aditivo" : "a proposta";
  const doc = `${objeto} “${p.titulo}” de ${p.prestador}`;
  const valor = p.valorCentavos === null ? "" : `, no valor de ${formatCentavos(p.valorCentavos)}`;

  if (acao === "aceito") {
    return (
      `Li ${doc}${valor}, e aceito os termos acima. ` +
      "Entendo que este aceite fica registrado com data, hora e dispositivo, e que meu nome, CPF e " +
      `e-mail são usados apenas para comprovar este aceite entre mim e ${p.prestador}.`
    );
  }
  if (acao === "recusado") return `Recuso ${doc}. ${registro}`;
  return `Peço ajuste ${tipo === "aditivo" ? "no aditivo" : "na proposta"} “${p.titulo}” de ${p.prestador}, conforme o comentário acima. ${registro}`;
}
