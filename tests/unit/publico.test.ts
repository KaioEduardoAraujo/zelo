import { describe, expect, it } from "vitest";

import { emailCodigo, escapeHtml } from "@/lib/email/templates";
import { maskEmail } from "@/lib/format";
import { textoConsentimento } from "@/lib/publico/consentimento";
import { codigoValido, gerarCodigo, hashCodigo } from "@/lib/publico/otp";
import { codigoSchema, respostaSchema } from "@/lib/publico/schemas";
import { flattenIssues } from "@/lib/validation/errors";

const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres!!";
const ID = "4432da9c-0efd-4576-8807-500c3dbcac20";

describe("código OTP", () => {
  it("tem sempre 6 dígitos (inclusive com zeros à esquerda) e varia", () => {
    const codigos = Array.from({ length: 2000 }, gerarCodigo);
    expect(codigos.every((c) => /^\d{6}$/.test(c))).toBe(true);
    expect(new Set(codigos).size).toBeGreaterThan(1900);
  });

  it("codigoValido", () => {
    expect(codigoValido("012345")).toBe(true);
    for (const ruim of ["12345", "1234567", "12a456", " 123456", 123456, null])
      expect(codigoValido(ruim)).toBe(false);
  });

  it("o hash amarra o código à proposta e à ação", () => {
    const base = hashCodigo(SEGREDO, ID, "aceito", "123456");
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCodigo(SEGREDO, ID, "aceito", "123456")).toBe(base);
    expect(hashCodigo(SEGREDO, ID, "recusado", "123456")).not.toBe(base); // código de recusa não aceita
    expect(
      hashCodigo(SEGREDO, "11111111-1111-4111-8111-111111111111", "aceito", "123456"),
    ).not.toBe(base);
    expect(
      hashCodigo("outro-segredo-qualquer-com-32-caracteres!!", ID, "aceito", "123456"),
    ).not.toBe(base);
  });
});

describe("textoConsentimento", () => {
  const p = {
    titulo: "Reforma do banheiro",
    prestador: "Andrade Reformas",
    valorCentavos: 513_000,
  };

  it("aceite: diz o que, de quem, quanto e a finalidade dos dados", () => {
    const t = textoConsentimento("aceito", p);
    expect(t).toContain("a proposta “Reforma do banheiro” de Andrade Reformas");
    expect(t).toContain("R$ 5.130,00");
    expect(t).toContain("aceito os termos acima");
    expect(t).toContain("data, hora e dispositivo");
    expect(t).toMatch(/nome, CPF e e-mail são usados apenas para comprovar/);
  });

  it("recusa e ajuste têm textos próprios, sem pedir CPF", () => {
    expect(textoConsentimento("recusado", p)).toMatch(
      /^Recuso a proposta “Reforma do banheiro” de Andrade Reformas\./,
    );
    expect(textoConsentimento("ajuste", p)).toMatch(
      /^Peço ajuste na proposta “Reforma do banheiro” de Andrade Reformas, conforme o comentário acima\./,
    );
    expect(textoConsentimento("recusado", p)).not.toContain("CPF");
  });
});

describe("respostaSchema", () => {
  const aceite = {
    acao: "aceito",
    nome: "Mariana Costa",
    cpf: "529.982.247-25",
    consentimento: true,
  };

  it("aceite válido guarda o CPF só com dígitos", () => {
    expect(respostaSchema.parse(aceite).cpf).toBe("52998224725");
  });

  it("aceite exige CPF válido e o consentimento marcado", () => {
    const r = respostaSchema.safeParse({ ...aceite, cpf: "111.111.111-11", consentimento: false });
    expect(Object.keys(flattenIssues(r.error!)).sort()).toEqual(["consentimento", "cpf"]);
  });

  it("ajuste exige comentário; recusa e ajuste não exigem CPF", () => {
    const ajuste = respostaSchema.safeParse({
      acao: "ajuste",
      nome: "Mariana Costa",
      consentimento: true,
    });
    expect(flattenIssues(ajuste.error!)).toEqual({
      comentario: "Conte o que você gostaria de mudar.",
    });
    expect(
      respostaSchema.safeParse({
        acao: "ajuste",
        nome: "Mariana Costa",
        comentario: "Incluir a película",
        consentimento: true,
      }).success,
    ).toBe(true);
    expect(
      respostaSchema.safeParse({ acao: "recusado", nome: "Mariana Costa", consentimento: true })
        .success,
    ).toBe(true);
  });

  it("aponta todos os erros de uma vez (não um por vez)", () => {
    const r = respostaSchema.safeParse({
      acao: "aceito",
      nome: "M",
      cpf: "123",
      consentimento: false,
    });
    expect(Object.keys(flattenIssues(r.error!)).sort()).toEqual(["consentimento", "cpf", "nome"]);
  });

  it("recusa ação desconhecida e campos extras não passam adiante", () => {
    expect(respostaSchema.safeParse({ ...aceite, acao: "aprovado" }).success).toBe(false);
    expect(respostaSchema.parse({ ...aceite, status: "aceita" })).not.toHaveProperty("status");
  });

  it("codigoSchema", () => {
    expect(codigoSchema.safeParse(" 012345 ").success).toBe(true);
    expect(codigoSchema.safeParse("12345").success).toBe(false);
  });
});

describe("maskEmail", () => {
  it("mostra só a primeira letra e o domínio", () => {
    expect(maskEmail("mariana.costa@example.com")).toBe("m***@example.com");
    expect(maskEmail("lixo")).toBe("***");
  });
});

describe("emailCodigo", () => {
  it("traz o código, para que ele serve, a validade e o aviso de ignorar", () => {
    const e = emailCodigo({
      codigo: "012345",
      acao: "aceito",
      titulo: "Reforma",
      prestador: "Andrade",
      minutos: 10,
    });
    expect(e.assunto).toBe("012345 é o seu código no Zelo");
    expect(e.texto).toContain("Seu código para aceitar a proposta “Reforma”, de Andrade:");
    expect(e.texto).toContain("012345");
    expect(e.texto).toContain("10 minutos");
    expect(e.html).toContain(">012345<");
    expect(
      emailCodigo({ codigo: "1", acao: "ajuste", titulo: "X", prestador: "Y", minutos: 10 }).texto,
    ).toContain("pedir ajuste na proposta “X”");
  });

  it("escapa HTML vindo do título e do nome do prestador", () => {
    const e = emailCodigo({
      codigo: "012345",
      acao: "recusado",
      titulo: '<a href="https://golpe.example">clique</a>',
      prestador: "<script>x</script>",
      minutos: 10,
    });
    expect(e.html).not.toContain("<a href=");
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;a href=&quot;https://golpe.example&quot;&gt;");
    expect(escapeHtml(`'"&<>`)).toBe("&#39;&quot;&amp;&lt;&gt;");
  });
});
