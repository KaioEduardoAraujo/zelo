import "server-only";

import { Resend } from "resend";

import type { EmailProvider } from "@/lib/email/types";

// Sem domínio verificado, o Resend só entrega ao dono da conta.
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
      // O erro do provedor pode conter o destinatário: não sai daqui.
      if (error) throw new Error("Falha ao enviar e-mail pelo Resend");
    },
  };
}
