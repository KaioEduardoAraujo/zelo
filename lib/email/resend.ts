import "server-only";

import { Resend } from "resend";

import type { EmailProvider } from "@/lib/email/types";

/** Resend (100 e-mails por dia no plano gratuito). Sem domínio verificado, só entrega ao dono da conta. */
export function criarResend(apiKey: string): EmailProvider {
  const resend = new Resend(apiKey);
  return {
    async enviar(m) {
      const { error } = await resend.emails.send({
        from: m.de,
        to: m.para,
        subject: m.assunto,
        html: m.html,
        text: m.texto,
        attachments: m.anexos?.map((a) => ({
          filename: a.nome,
          content: a.conteudo,
          contentType: a.tipo,
        })),
      });
      // A mensagem de erro do provedor não sai daqui (pode conter o endereço do destinatário).
      if (error) throw new Error("Falha ao enviar e-mail pelo Resend");
    },
  };
}
