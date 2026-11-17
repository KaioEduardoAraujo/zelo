import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { renderizarComprovante, type ComprovanteProps } from "@/lib/pdf/comprovante";

const HASH = "a".repeat(32) + "0123456789abcdef".repeat(2);

export const dadosExemplo: ComprovanteProps["dados"] = {
  aceite: {
    id: "8c1f3a52-7a43-4ab3-9e07-55c2f2b1d9a0",
    codigo: "ZL-4K7Q-92MD",
    resultado: "aceito",
    criadoEm: "2026-11-16T17:32:10.000Z",
    otpVerificadoEm: "2026-11-16T17:32:10.000Z",
    clienteNome: "Mariana Costa",
    clienteCpf: "52998224725",
    comentario: null,
    ip: "177.12.34.56",
    userAgent:
      "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
    textoConsentimento:
      "Li e aceito a proposta “Reforma do banheiro”, de Andrade Reformas, no valor de R$ 8.400,00.",
    hashDocumento: HASH,
    pdfPath: "x/y.pdf",
  },
  proposta: { id: "4432da9c-0efd-4576-8807-500c3dbcac20", prestadorId: "x", tipo: "proposta" },
  versao: { id: "v1", numero: 2, enviadaEm: "2026-11-15T12:00:00.000Z", hash: HASH },
  partes: {
    titulo: "Reforma do banheiro",
    prestador: { nome: "Carlos Andrade", empresa: "Andrade Reformas" },
    cliente: { nome: "Mariana Costa", email: "mariana@example.com", telefone: null },
  },
  conteudo: {
    escopo: "Reforma completa do banheiro social, com troca de piso e revestimento (≈ 6 m²).",
    itens: [
      { descricao: "Demolição", unidade: "vb", quantidade: 1, valor_unitario_centavos: 120_000 },
      {
        descricao: "Porcelanato 60×60 – assentamento",
        unidade: "m²",
        quantidade: 22.5,
        valor_unitario_centavos: 32_000,
      },
    ],
    exclusoes: ["Louças e metais", "Retirada de entulho"],
    valor_total_centavos: 840_000,
    prazo: "15 dias úteis",
    pagamento: "50% na entrada e 50% na entrega",
    garantia: "90 dias para mão de obra",
    validade_dias: 15,
    observacoes: "Ação começa após a aprovação. Emoji não suportado vira caractere vazio: 👍",
  },
  entrega: null,
  integro: true,
  eventos: [
    { tipo: "enviada", criadoEm: "2026-11-15T12:00:00.000Z", ip: null, userAgent: null },
    {
      tipo: "aberta",
      criadoEm: "2026-11-16T17:20:00.000Z",
      ip: "177.12.34.56",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Version/18.1 Safari/604.1",
    },
    { tipo: "aceita", criadoEm: "2026-11-16T17:32:10.000Z", ip: "177.12.34.56", userAgent: null },
  ],
};

describe("comprovante em PDF", () => {
  it("gera um PDF válido com acentos, m² e emoji sem quebrar", async () => {
    const pdf = await renderizarComprovante({
      dados: dadosExemplo,
      urlVerificacao: "http://localhost:3000/verificar",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5_000);
    // Para olhar o resultado: PDF_SAIDA=/caminho/arquivo.pdf npm test -- comprovante
    if (process.env.PDF_SAIDA) writeFileSync(process.env.PDF_SAIDA, pdf);
  }, 30_000);

  it("aditivo: mostra a referência à proposta original", async () => {
    const pdf = await renderizarComprovante({
      dados: {
        ...dadosExemplo,
        proposta: { ...dadosExemplo.proposta, tipo: "aditivo" },
        partes: {
          ...dadosExemplo.partes,
          titulo: "Aditivo: Reforma do banheiro",
          referencia: {
            proposta_id: "4432da9c-0efd-4576-8807-500c3dbcac20",
            titulo: "Reforma do banheiro",
            hash_documento: "f".repeat(64),
          },
        },
      },
      urlVerificacao: "http://localhost:3000/verificar",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    if (process.env.PDF_ADITIVO) writeFileSync(process.env.PDF_ADITIVO, pdf);
  }, 30_000);

  it("entrega: checklist e fotos (imagem embutida e imagem não incluída)", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const pai = "11111111-1111-4111-8111-111111111111";
    const prop = "22222222-2222-4222-8222-222222222222";
    const f1 = `${pai}/${prop}/33333333-3333-4333-8333-333333333333.png`;
    const f2 = `${pai}/${prop}/44444444-4444-4444-8444-444444444444.webp`;
    const pdf = await renderizarComprovante({
      dados: {
        ...dadosExemplo,
        proposta: { ...dadosExemplo.proposta, id: prop, prestadorId: pai, tipo: "entrega" },
        partes: {
          ...dadosExemplo.partes,
          titulo: "Entrega: Reforma do banheiro",
          referencia: {
            proposta_id: "4432da9c-0efd-4576-8807-500c3dbcac20",
            titulo: "Reforma do banheiro",
            hash_documento: "f".repeat(64),
          },
        },
        entrega: {
          resumo: "Piso e revestimento concluídos; rejunte e limpeza final feitos (≈ 6 m²).",
          checklist: [
            { texto: "Piso assentado", feito: true },
            { texto: "Revestimento das paredes", feito: true },
          ],
          fotos: [
            {
              path: f1,
              nome: "banheiro.png",
              sha256: "a".repeat(64),
              bytes: png.length,
              tipo: "image/png",
            },
            {
              path: f2,
              nome: "detalhe.webp",
              sha256: "b".repeat(64),
              bytes: 999,
              tipo: "image/webp",
            },
          ],
          observacoes: "Cliente acompanhou a entrega.",
          validade_dias: 15,
        },
      },
      imagens: { [f1]: { data: png, formato: "png" } },
      urlVerificacao: "http://localhost:3000/verificar",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5_000);
    if (process.env.PDF_ENTREGA) writeFileSync(process.env.PDF_ENTREGA, pdf);
  }, 30_000);
});
