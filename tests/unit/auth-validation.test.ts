import { describe, expect, it } from "vitest";

import {
  fieldErrors,
  loginSchema,
  passwordSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth";

describe("passwordSchema", () => {
  it("exige 8+ caracteres com letras e números", () => {
    expect(passwordSchema.safeParse("abc12345").success).toBe(true);
    expect(passwordSchema.safeParse("abc123").success).toBe(false);
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("a1".repeat(37)).success).toBe(false); // > 72 (limite do bcrypt)
  });
});

describe("signupSchema", () => {
  const base = { nome: "Ana Souza", email: "Ana@Example.com ", password: "senha1234" };

  it("normaliza e-mail e trata opcionais vazios", () => {
    const r = signupSchema.parse({ ...base, empresa_nome: "", telefone: "" });
    expect(r.email).toBe("ana@example.com");
    expect(r.empresa_nome).toBeUndefined();
    expect(r.telefone).toBeUndefined();
  });

  it("guarda só os dígitos do telefone", () => {
    expect(signupSchema.parse({ ...base, telefone: "(11) 98765-4321" }).telefone).toBe(
      "11987654321",
    );
  });

  it("recusa telefone sem DDD", () => {
    const r = signupSchema.safeParse({ ...base, telefone: "98765-4321" });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!)).toEqual({ telefone: "Informe o telefone com DDD." });
  });

  it("ignora campos extras como role", () => {
    const r = signupSchema.parse({ ...base, role: "admin" });
    expect(r).not.toHaveProperty("role");
  });
});

describe("loginSchema e resetPasswordSchema", () => {
  it("aponta o campo com erro", () => {
    const r = loginSchema.safeParse({ email: "sem-arroba", password: "" });
    expect(Object.keys(fieldErrors(r.error!)).sort()).toEqual(["email", "password"]);
  });

  it("exige confirmação igual", () => {
    const r = resetPasswordSchema.safeParse({ password: "senha1234", confirm: "senha12345" });
    expect(fieldErrors(r.error!)).toEqual({ confirm: "As senhas não são iguais." });
  });
});
