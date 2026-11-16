import "server-only";

import { z } from "zod";

/*
 * Segredos do servidor. O import "server-only" acima faz o build quebrar se este
 * arquivo for parar num componente de cliente — é a nossa garantia de que a chave
 * service_role nunca chega ao navegador (regra inegociável nº 4).
 */
const serverSchema = z
  .object({
    // Chave com privilégio total (ignora RLS). Aceita a "service_role" (legada)
    // ou a nova "secret key" (sb_secret_...) do Supabase.
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

    // Segredo do HMAC-SHA256 usado para guardar o hash do OTP e do token do link.
    // Um OTP tem só 1 milhão de combinações: sem esse segredo, quem vazasse o banco
    // descobriria o código por força bruta em segundos.
    HASH_PEPPER: z.string().min(32),

    EMAIL_PROVIDER: z.enum(["resend", "smtp"]).default("resend"),
    EMAIL_FROM: z.string().min(3),
    RESEND_API_KEY: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "obrigatória" });
    }
    if (env.EMAIL_PROVIDER === "smtp") {
      for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "obrigatória" });
      }
    }
  });

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente do servidor inválidas: ${missing}. Veja .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
