import "server-only";

import { serverEnv } from "@/lib/env.server";
import { criarResend } from "@/lib/email/resend";
import { criarSmtp } from "@/lib/email/smtp";
import type { EmailProvider, MensagemEmail } from "@/lib/email/types";

let provedor: EmailProvider | undefined;

function obterProvedor(): EmailProvider {
  if (provedor) return provedor;
  const env = serverEnv();
  provedor =
    env.EMAIL_PROVIDER === "smtp"
      ? criarSmtp({
          host: env.SMTP_HOST!,
          port: env.SMTP_PORT!,
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        })
      : criarResend(env.RESEND_API_KEY!);
  return provedor;
}

export async function enviarEmail(mensagem: MensagemEmail): Promise<void> {
  await obterProvedor().enviar({ ...mensagem, de: serverEnv().EMAIL_FROM });
}
