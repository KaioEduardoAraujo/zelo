import { describe, expect, it } from "vitest";

import { canonicalize } from "@/lib/crypto/canonical";
import { hashDocumento } from "@/lib/crypto/hash";
import {
  mensagemWhatsApp,
  prepararDocumento,
  primeiroNome,
  telefoneWhatsApp,
  urlWhatsApp,
  type PrepararEntrada,
} from "@/lib/proposals/envio";

const ID = "4432da9c-0efd-4576-8807-500c3dbcac20";

const entrada: PrepararEntrada = {
  propostaId: ID,
  versao: 1,
  titulo: "  Reforma do banheiro ",
  clienteNome: "Mariana Costa",
  clienteEmail: "Mariana@Example.com",
  clienteTelefone: "11987654321",
  prestadorNome: "Carlos Andrade",
  prestadorEmpresa: "Andrade Reformas",
  conteudo: {
    escopo: "Reforma completa do banheiro social, com troca de piso e revestimento.",
    itens: [
      { descricao: "Demolição", unidade: "vb", quantidade: 1, valor_unitario_centavos: 120_000 },
      {
        descricao: "Porcelanato",
        unidade: "m²",
        quantidade: 22.5,
        valor_unitario_centavos: 11_000,
      },
    ],
    exclusoes: ["Compra do porcelanato"],
    valor_total_centavos: 1, // errado de propósito: o servidor recalcula
    prazo: "15 dias úteis",
    pagamento: "50% + 50%",
    garantia: "12 meses",
    validade_dias: 15,
    lixo: "campo desconhecido",
  },
};

describe("prepararDocumento", () => {
  it("monta o documento com o retrato das partes e a identidade do registro", () => {
    const r = prepararDocumento(entrada);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.documento).toMatchObject({
      proposta_id: ID,
      versao: 1,
      titulo: "Reforma do banheiro", // aparado
      valor_total_centavos: 367_500, // recalculado: 120000 + 22,5 × 11000
      prestador: { nome: "Carlos Andrade", empresa: "Andrade Reformas" },
      cliente: { nome: "Mariana Costa", email: "mariana@example.com", telefone: "11987654321" }, // e-mail em minúsculas
    });
    expect(r.documento).not.toHaveProperty("lixo");
    expect(r.hash).toBe(hashDocumento(r.documento));
  });

  it("o hash não depende da ordem das chaves da entrada", () => {
    const a = prepararDocumento(entrada);
    const b = prepararDocumento({
      ...entrada,
      conteudo: Object.fromEntries(Object.entries(entrada.conteudo as object).reverse()),
    });
    expect(a.ok && b.ok && a.hash === b.hash).toBe(true);
  });

  it("o hash amarra o documento à proposta e à versão", () => {
    const base = prepararDocumento(entrada);
    const outraVersao = prepararDocumento({ ...entrada, versao: 2 });
    const outraProposta = prepararDocumento({
      ...entrada,
      propostaId: "11111111-1111-4111-8111-111111111111",
    });
    expect(base.ok && outraVersao.ok && outraProposta.ok).toBe(true);
    if (!base.ok || !outraVersao.ok || !outraProposta.ok) return;
    expect(outraVersao.hash).not.toBe(base.hash);
    expect(outraProposta.hash).not.toBe(base.hash);
  });

  it("mudar o prestador ou o cliente muda o hash (o retrato das partes é selado)", () => {
    const base = prepararDocumento(entrada);
    const outro = prepararDocumento({ ...entrada, prestadorEmpresa: "Outra Empresa" });
    expect(base.ok && outro.ok && base.hash !== outro.hash).toBe(true);
  });

  it("a serialização canônica do documento não tem espaços fora de textos e começa pelas chaves em ordem", () => {
    const r = prepararDocumento(entrada);
    if (!r.ok) throw new Error("deveria ser válido");
    const c = canonicalize(r.documento);
    expect(c.startsWith('{"cliente":{')).toBe(true);
    expect(c).not.toMatch(/"\s*:\s+|,\s+"/);
  });

  it("recusa conteúdo incompleto, apontando cada campo (o servidor valida de novo)", () => {
    const r = prepararDocumento({
      ...entrada,
      clienteEmail: "sem-arroba",
      conteudo: { ...(entrada.conteudo as object), prazo: "", itens: [] },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.erros).sort()).toEqual(
      ["cliente.email", "itens", "prazo", "valor_total_centavos"].sort(),
    );
  });

  it("recusa rascunho em branco e conteúdo malformado sem lançar erro", () => {
    expect(prepararDocumento({ ...entrada, conteudo: {} }).ok).toBe(false);
    expect(prepararDocumento({ ...entrada, conteudo: "texto" }).ok).toBe(false);
    expect(prepararDocumento({ ...entrada, conteudo: null }).ok).toBe(false);
  });

  it("empresa vazia vira null", () => {
    const r = prepararDocumento({ ...entrada, prestadorEmpresa: "   " });
    expect(r.ok && r.documento.prestador.empresa).toBeNull();
  });

  it("telefone ausente vira null no retrato", () => {
    const r = prepararDocumento({ ...entrada, clienteTelefone: null });
    expect(r.ok && r.documento.cliente.telefone).toBeNull();
  });
});

describe("telefoneWhatsApp / urlWhatsApp", () => {
  it.each([
    ["11987654321", "5511987654321"],
    ["1134567890", "551134567890"],
    ["(11) 98765-4321", "5511987654321"],
    ["5511987654321", "5511987654321"],
    ["551134567890", "551134567890"],
    ["55991234567", "5555991234567"], // DDD 55 (RS) com 11 dígitos é nacional, não "55" + 9 dígitos
  ])("%j → %j", (entrada, esperado) => {
    expect(telefoneWhatsApp(entrada)).toBe(esperado);
  });

  it.each(["", "123", "123456789", "+1 202 555 0100 99999", null, undefined])(
    "%j → sem número",
    (entrada) => {
      expect(telefoneWhatsApp(entrada)).toBeNull();
    },
  );

  it("monta o link wa.me com a mensagem codificada", () => {
    const url = urlWhatsApp("11987654321", "Olá!\nTudo bem? 100% & mais");
    expect(url.startsWith("https://wa.me/5511987654321?text=")).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe("Olá!\nTudo bem? 100% & mais");
    expect(url).not.toMatch(/[\s&](?=.*text=)/); // nada de espaço ou & cru antes do texto
  });

  it("sem telefone, abre o WhatsApp para escolher o contato", () => {
    expect(urlWhatsApp(null, "oi")).toBe("https://wa.me/?text=oi");
  });
});

describe("mensagemWhatsApp", () => {
  const resumo = {
    clienteNome: "Mariana Costa",
    prestadorNome: "Andrade Reformas",
    titulo: "Reforma do banheiro",
    tipo: "proposta" as const,
    valorCentavos: 513_000,
    link: "https://zelo.example/p/ABC",
    validadeEm: "2026-12-01T16:12:00Z",
  };

  it("é curta, em português e traz o link, o valor e a validade", () => {
    const m = mensagemWhatsApp(resumo);
    expect(m).toContain("Olá, Mariana! Aqui é Andrade Reformas.");
    expect(m).toContain("“Reforma do banheiro”, no valor de R$ 5.130,00");
    expect(m).toContain("https://zelo.example/p/ABC");
    expect(m).toContain("A proposta vale até 01/12/2026 13:12.");
    expect(m.length).toBeLessThan(400);
  });

  it("primeiroNome", () => {
    expect(primeiroNome("  Mariana   Costa ")).toBe("Mariana");
    expect(primeiroNome("Cher")).toBe("Cher");
  });
});
