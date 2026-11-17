import "server-only";

import nodemailer from "nodemailer";

import type { EmailProvider } from "@/lib/email/types";

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
