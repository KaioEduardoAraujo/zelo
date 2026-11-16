import "server-only";

import nodemailer from "nodemailer";

import type { EmailProvider } from "@/lib/email/types";

/**
 * SMTP (ex.: Gmail com "senha de app", ou o Mailpit do Supabase local).
 * Alternativa ao Resend para quando não há domínio verificado: o Resend sem domínio só
 * entrega para o e-mail do dono da conta (PROMPT-INICIAL, seção 5).
 */
export function criarSmtp(cfg: {
  host: string;
  port: number;
  user?: string;
  pass?: string;
}): EmailProvider {
  const transporte = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465, // 465 = TLS direto; 587/25 = STARTTLS
    auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
  });

  return {
    async enviar(m) {
      await transporte.sendMail({
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
    },
  };
}
