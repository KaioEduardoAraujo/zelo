import { describe, expect, it } from "vitest";

import { emailComprovante } from "@/lib/email/templates";
import { paraFontePdf, sanitizarParaPdf } from "@/lib/pdf/texto";
import { normalizarCodigo, verificacaoSchema } from "@/lib/verificar/schemas";

describe("texto do PDF (só caracteres que a fonte desenha)", () => {
  it("mantém português, aspas, travessão, m², € e quebras de linha", () => {
    const t = "Ação — “Reforma” de 6 m² por R$ 8.400,00 (€)\nlinha 2 • item…";
    expect(paraFontePdf(t)).toBe(t);
  });

  it("troca símbolos conhecidos e tira acento de letras fora do Latin-1", () => {
    expect(paraFontePdf("≈ 6 m² → pronto ≥ 2")).toBe("~ 6 m² -> pronto >= 2");
    expect(paraFontePdf("Nguyễn")).toBe("Nguyen");
  });

  it("emoji vira ? (inclusive os de vários códigos) e não deixa lixo", () => {
    expect(paraFontePdf("ok 👍")).toBe("ok ?");
    expect(paraFontePdf("❤️")).toBe("?");
    expect(paraFontePdf("👨‍👩‍👧")).toBe("???");
  });

  it("sanitiza objetos inteiros sem alterar o original", () => {
    const original = { a: "x ≈ y", b: [{ c: "→" }], n: 3, nulo: null };
    expect(sanitizarParaPdf(original)).toEqual({ a: "x ~ y", b: [{ c: "->" }], n: 3, nulo: null });
    expect(original.a).toBe("x ≈ y");
  });
});

describe("código do comprovante na verificação", () => {
  it("normaliza o que a pessoa digita", () => {
    expect(normalizarCodigo("zl-4k7q-92md")).toBe("ZL-4K7Q-92MD");
    expect(normalizarCodigo(" ZL 4K7Q 92MD ")).toBe("ZL-4K7Q-92MD");
    expect(normalizarCodigo("4k7q92md")).toBe("ZL-4K7Q-92MD");
  });

  it("recusa formato errado e hash de arquivo inválido", () => {
    expect(verificacaoSchema.safeParse({ codigo: "ZL-4K7Q" }).success).toBe(false);
    // 0 e 1 não existem no alfabeto do código (confundem com O e I)
    expect(verificacaoSchema.safeParse({ codigo: "ZL-0000-1111" }).success).toBe(false);
    expect(
      verificacaoSchema.safeParse({ codigo: "ZL-4K7Q-92MD", arquivoSha256: "xyz" }).success,
    ).toBe(false);
    expect(
      verificacaoSchema.safeParse({ codigo: "ZL-4K7Q-92MD", arquivoSha256: "a".repeat(64) })
        .success,
    ).toBe(true);
  });
});

describe("e-mail do comprovante", () => {
  const base = {
    titulo: 'Reforma <script>alert("x")</script>',
    prestador: "Andrade & Filhos",
    clienteNome: "Mariana <b>Costa</b>",
    codigo: "ZL-4K7Q-92MD",
    registradoEm: "2026-11-16T17:32:00.000Z",
    urlVerificacao: "https://zelo.example/verificar",
    urlPainel: "https://zelo.example/propostas/1",
  };

  it("escapa o que foi digitado por usuários", () => {
    const e = emailComprovante({ ...base, para: "prestador" });
    expect(e.html).not.toContain("<script>");
    expect(e.html).not.toContain("<b>Costa");
    expect(e.html).toContain("&lt;b&gt;Costa&lt;/b&gt;");
    expect(emailComprovante({ ...base, para: "cliente" }).html).toContain("Andrade &amp; Filhos");
  });

  it("textos diferentes para cliente e prestador; só o prestador recebe o link do painel", () => {
    const cliente = emailComprovante({ ...base, para: "cliente" });
    const prestador = emailComprovante({ ...base, para: "prestador" });
    expect(cliente.assunto).toMatch(/^Comprovante do seu aceite:/);
    expect(prestador.assunto).toMatch(/^Proposta aceita:/);
    expect(cliente.texto).toContain("16/11/2026 14:32");
    expect(cliente.texto).toContain("https://zelo.example/verificar?codigo=ZL-4K7Q-92MD");
    expect(cliente.html).not.toContain(base.urlPainel);
    expect(prestador.html).toContain(base.urlPainel);
  });
});
