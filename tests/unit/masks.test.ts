import { describe, expect, it } from "vitest";

import { formatRelative } from "@/lib/format";
import { maskCpf, maskPhone, parseMoneyInput } from "@/lib/masks";
import { summarizeUserAgent } from "@/lib/user-agent";
import { isValidCpf } from "@/lib/validation/cpf";

describe("máscaras", () => {
  it("CPF enquanto digita", () => {
    expect(maskCpf("123")).toBe("123");
    expect(maskCpf("1234")).toBe("123.4");
    expect(maskCpf("1234567")).toBe("123.456.7");
    expect(maskCpf("12345678909")).toBe("123.456.789-09");
    expect(maskCpf("123.456.789-0999")).toBe("123.456.789-09");
  });

  it("telefone fixo e celular", () => {
    expect(maskPhone("11")).toBe("(11");
    expect(maskPhone("119876")).toBe("(11) 9876");
    expect(maskPhone("1134567890")).toBe("(11) 3456-7890");
    expect(maskPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("dinheiro entra pela direita, em centavos", () => {
    expect(parseMoneyInput("")).toBe(0);
    expect(parseMoneyInput("1")).toBe(1);
    expect(parseMoneyInput("R$ 8.400,00")).toBe(840_000);
    expect(parseMoneyInput("99999999999999")).toBe(1_000_000_000);
  });
});

describe("isValidCpf", () => {
  it("aceita CPFs válidos com ou sem pontuação", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("12345678909")).toBe(true);
  });

  it("recusa dígito verificador errado, sequência repetida e tamanho errado", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("1234567890")).toBe(false);
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-11-16T12:00:00Z");
  it("descreve o tempo em português", () => {
    expect(formatRelative("2026-11-16T11:59:40Z", now)).toBe("agora");
    expect(formatRelative("2026-11-16T11:55:00Z", now)).toBe("há 5 minutos");
    expect(formatRelative("2026-11-15T12:00:00Z", now)).toBe("ontem");
    expect(formatRelative("2026-11-02T12:00:00Z", now)).toBe("há 2 semanas");
    expect(formatRelative("2026-11-19T12:00:00Z", now)).toBe("em 3 dias");
  });
});

describe("summarizeUserAgent", () => {
  it("resume os navegadores mais comuns", () => {
    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("Android 15, Chrome 131");
    expect(
      summarizeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("iPhone, iOS 18, Safari 18");
    expect(summarizeUserAgent(null)).toBe("Dispositivo não identificado");
  });
});
