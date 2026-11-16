import { describe, expect, it } from "vitest";

import { formatCentavos, formatCurrency, formatDateTime, maskCpf } from "@/lib/format";

describe("formatCurrency", () => {
  it("formata em reais com separadores brasileiros", () => {
    expect(formatCurrency(8400)).toBe("R$ 8.400,00");
    expect(formatCurrency(1234.5)).toBe("R$ 1.234,50");
  });
});

describe("formatCentavos", () => {
  it("converte centavos em reais", () => {
    expect(formatCentavos(840_000)).toBe("R$ 8.400,00");
    expect(formatCentavos(97_050)).toBe("R$ 970,50");
  });
});

describe("formatDateTime", () => {
  it("usa dd/MM/yyyy HH:mm no fuso de Brasília", () => {
    // 17:32 UTC = 14:32 em São Paulo (UTC-3)
    expect(formatDateTime("2026-11-12T17:32:00Z")).toBe("12/11/2026 14:32");
  });
});

describe("maskCpf", () => {
  it("mostra só os dígitos do meio (LGPD)", () => {
    expect(maskCpf("123.456.789-09")).toBe("***.456.789-**");
    expect(maskCpf("12345678909")).toBe("***.456.789-**");
  });

  it("não vaza nada quando o CPF é inválido", () => {
    expect(maskCpf("123")).toBe("***.***.***-**");
  });
});
