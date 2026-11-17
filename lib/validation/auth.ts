import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe seu e-mail.")
  .max(254, "E-mail longo demais.")
  .pipe(z.email("Confira o e-mail: parece que falta alguma parte."));

// Máx. 72: limite do bcrypt.
export const passwordSchema = z
  .string()
  .min(8, "Use pelo menos 8 caracteres.")
  .max(72, "Use no máximo 72 caracteres.")
  .regex(/[A-Za-z]/, "Inclua pelo menos uma letra.")
  .regex(/\d/, "Inclua pelo menos um número.");

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

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

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
