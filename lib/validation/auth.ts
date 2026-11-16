import { z } from "zod";

/*
 * Validação dos formulários de autenticação. Usada no servidor (Server Actions) — a entrada
 * do navegador nunca é confiável — e pode ser reaproveitada no cliente para feedback rápido.
 * Mensagens em português, no tom do DESIGN.md.
 */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe seu e-mail.")
  .max(254, "E-mail longo demais.")
  .pipe(z.email("Confira o e-mail: parece que falta alguma parte."));

/** Mesmas regras configuradas no Supabase Auth (mín. 8, letras e números). Máx. 72 = limite do bcrypt. */
export const passwordSchema = z
  .string()
  .min(8, "Use pelo menos 8 caracteres.")
  .max(72, "Use no máximo 72 caracteres.")
  .regex(/[A-Za-z]/, "Inclua pelo menos uma letra.")
  .regex(/\d/, "Inclua pelo menos um número.");

/** "" vira undefined: campos opcionais chegam vazios do FormData. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

/** Aceita "(11) 98765-4321" e guarda só os dígitos (DDD + número). */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v === "" || /^\d{10,11}$/.test(v), "Informe o telefone com DDD.")
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha.").max(72),
  next: z.string().optional(),
});

export const signupSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome longo demais."),
  empresa_nome: optionalText(120, "Nome da empresa longo demais."),
  telefone: phoneSchema,
  email,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não são iguais.",
    path: ["confirm"],
  });

/** Converte erros do Zod em { campo: "primeira mensagem" } para exibir abaixo de cada input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
