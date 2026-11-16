import { formatCentavos } from "@/lib/format";
import type { AcaoCliente } from "@/lib/publico/otp";

/*
 * Texto de consentimento (DESIGN.md 8 e LGPD): claro, em primeira pessoa, com a FINALIDADE dos
 * dados. É montado no servidor e gravado no aceite exatamente como foi mostrado.
 */
export function textoConsentimento(
  acao: AcaoCliente,
  p: { titulo: string; prestador: string; valorCentavos: number },
): string {
  const doc = `a proposta “${p.titulo}” de ${p.prestador}`;
  const registro =
    "Entendo que esta resposta fica registrada com data, hora e dispositivo, e que meu nome e meu e-mail são usados apenas para comprová-la.";

  if (acao === "aceito") {
    return (
      `Li ${doc}, no valor de ${formatCentavos(p.valorCentavos)}, e aceito os termos acima. ` +
      "Entendo que este aceite fica registrado com data, hora e dispositivo, e que meu nome, CPF e " +
      `e-mail são usados apenas para comprovar este aceite entre mim e ${p.prestador}.`
    );
  }
  if (acao === "recusado") return `Recuso ${doc}. ${registro}`;
  return `Peço ajuste na proposta “${p.titulo}” de ${p.prestador}, conforme o comentário acima. ${registro}`;
}
