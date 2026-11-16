import { describe, expect, it } from "vitest";

import { isGuestOnlyPath, isProtectedPath, safeNextPath } from "@/lib/auth/routes";

describe("safeNextPath (proteção contra redirecionamento aberto)", () => {
  it("aceita caminhos internos", () => {
    expect(safeNextPath("/propostas")).toBe("/propostas");
    expect(safeNextPath("/propostas?status=aceita#topo")).toBe("/propostas?status=aceita#topo");
  });

  it.each([
    "https://site-malicioso.com",
    "//site-malicioso.com",
    "/\\site-malicioso.com",
    "javascript:alert(1)",
    "propostas",
    "/inicio\n/x",
    "",
    undefined,
    42,
  ])("recusa %j e usa o padrão", (next) => {
    expect(safeNextPath(next)).toBe("/inicio");
  });

  it("usa o fallback informado", () => {
    expect(safeNextPath("https://x.com", "/admin")).toBe("/admin");
  });
});

describe("rotas protegidas e de visitante", () => {
  it("identifica as áreas logadas", () => {
    expect(isProtectedPath("/inicio")).toBe(true);
    expect(isProtectedPath("/propostas/123")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/conta-suspensa")).toBe(false);
    expect(isProtectedPath("/p/token")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
  });

  it("identifica as telas de visitante", () => {
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/cadastro")).toBe(true);
    expect(isGuestOnlyPath("/redefinir-senha")).toBe(false);
  });
});
