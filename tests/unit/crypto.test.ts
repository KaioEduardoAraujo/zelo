import { describe, expect, it } from "vitest";

import { canonicalize } from "@/lib/crypto/canonical";
import { hashConfere, hashDocumento, hmacHex, iguais, sha256Hex } from "@/lib/crypto/hash";
import { gerarToken, hashToken, TOKEN_BYTES, tokenValido } from "@/lib/crypto/token";

describe("canonicalize", () => {
  it("ordena as chaves (recursivamente) e não usa espaços", () => {
    expect(canonicalize({ b: 1, a: { d: [1, 2], c: "x" } })).toBe(
      '{"a":{"c":"x","d":[1,2]},"b":1}',
    );
  });

  it("a ordem das chaves de entrada não muda o resultado", () => {
    const a = { escopo: "x", itens: [{ unidade: "m²", descricao: "Piso" }], prazo: "5 dias" };
    const b = { prazo: "5 dias", itens: [{ descricao: "Piso", unidade: "m²" }], escopo: "x" };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it("a ordem dos itens de uma lista FAZ parte do documento", () => {
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
  });

  it("omite propriedades undefined (como o JSON), mas mantém null", () => {
    expect(canonicalize({ a: undefined, b: null, c: 0 })).toBe('{"b":null,"c":0}');
  });

  it("preserva acentos, emoji e aspas sem ambiguidade", () => {
    expect(canonicalize({ t: 'Pintura "especial" ✓ ação' })).toBe(
      '{"t":"Pintura \\"especial\\" ✓ ação"}',
    );
  });

  it("números: 22,5 continua 22.5 e 1.0 é igual a 1 (como o jsonb devolve)", () => {
    expect(canonicalize({ q: 22.5, n: 1.0, z: -0 })).toBe('{"n":1,"q":22.5,"z":0}');
  });

  it.each([
    ["NaN", { a: NaN }],
    ["Infinity", { a: Infinity }],
    ["função", { a: () => 1 }],
    ["Date", { a: new Date() }],
    ["bigint", { a: BigInt(1) }],
    ["undefined solto", undefined],
  ])("recusa %s em vez de gerar um hash diferente em silêncio", (_nome, valor) => {
    expect(() => canonicalize(valor)).toThrow();
  });
});

describe("hashDocumento", () => {
  const doc = { valor_total_centavos: 513_000, itens: [{ descricao: "Demolição", quantidade: 1 }] };

  it("tem 64 caracteres hexadecimais minúsculos", () => {
    expect(hashDocumento(doc)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("é estável: o mesmo conteúdo, em qualquer ordem de chaves, dá o mesmo hash", () => {
    expect(hashDocumento(doc)).toBe(
      hashDocumento({
        itens: [{ quantidade: 1, descricao: "Demolição" }],
        valor_total_centavos: 513_000,
      }),
    );
  });

  it("qualquer alteração, mesmo de uma letra ou de 1 centavo, muda o hash", () => {
    const base = hashDocumento(doc);
    expect(hashDocumento({ ...doc, valor_total_centavos: 513_001 })).not.toBe(base);
    expect(hashDocumento({ ...doc, itens: [{ descricao: "Demolicao", quantidade: 1 }] })).not.toBe(
      base,
    );
  });

  it("bate com o SHA-256 conhecido do texto canônico", () => {
    // sha256 de '{"a":1}' calculado por fora (sha256sum)
    expect(sha256Hex('{"a":1}')).toBe(
      "015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862",
    );
    expect(hashDocumento({ a: 1 })).toBe(
      "015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862",
    );
  });

  it("hashConfere detecta adulteração e hash inválido", () => {
    const h = hashDocumento(doc);
    expect(hashConfere(doc, h)).toBe(true);
    expect(hashConfere({ ...doc, valor_total_centavos: 1 }, h)).toBe(false);
    expect(hashConfere(doc, null)).toBe(false);
    expect(hashConfere(doc, h.toUpperCase())).toBe(false);
    expect(hashConfere(doc, "abc")).toBe(false);
  });
});

describe("token do link", () => {
  it("tem 32 bytes de entropia em base64url (43 caracteres)", () => {
    expect(TOKEN_BYTES).toBeGreaterThanOrEqual(32);
    const t = gerarToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
  });

  it("nunca repete (1.000 tokens, nenhum igual)", () => {
    expect(new Set(Array.from({ length: 1000 }, gerarToken)).size).toBe(1000);
  });

  it("tokenValido recusa lixo vindo da URL", () => {
    expect(tokenValido(gerarToken())).toBe(true);
    for (const ruim of [
      "",
      "abc",
      "a".repeat(42),
      "a".repeat(44),
      `${"a".repeat(42)}!`,
      "../etc/passwd",
      null,
      42,
      undefined,
    ]) {
      expect(tokenValido(ruim), String(ruim)).toBe(false);
    }
  });

  it("o banco guarda só o HMAC: determinístico, depende do segredo e não revela o token", () => {
    const token = gerarToken();
    const segredo = "segredo-de-teste-com-mais-de-32-caracteres!!";
    const h = hashToken(segredo, token);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashToken(segredo, token));
    expect(h).not.toBe(hashToken("outro-segredo-qualquer-com-32-caracteres!", token));
    expect(h).not.toBe(sha256Hex(token)); // não é um SHA-256 puro
    expect(h).not.toContain(token);
    expect(h).toBe(hmacHex(segredo, token));
  });
});

describe("iguais (tempo constante)", () => {
  it("compara textos", () => {
    expect(iguais("abc", "abc")).toBe(true);
    expect(iguais("abc", "abd")).toBe(false);
    expect(iguais("abc", "abcd")).toBe(false);
  });
});
