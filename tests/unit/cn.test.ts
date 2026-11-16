import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn com a tipografia da Zelo", () => {
  it("tamanho e cor convivem (text-h1 não é tratado como cor)", () => {
    expect(cn("text-h1 text-navy-950")).toBe("text-h1 text-navy-950");
    expect(cn("text-support text-slate-600")).toBe("text-support text-slate-600");
    expect(cn("text-display text-navy-950", "max-lg:sr-only")).toBe(
      "text-display text-navy-950 max-lg:sr-only",
    );
  });

  it.each(["display", "h1", "h2", "h3", "body", "support", "label"])(
    "text-%s sobrevive a uma cor",
    (nome) => {
      expect(cn(`text-${nome}`, "text-teal-600")).toBe(`text-${nome} text-teal-600`);
    },
  );

  it("o último tamanho ainda vence o anterior", () => {
    expect(cn("text-h1", "text-support")).toBe("text-support");
    expect(cn("text-sm", "text-h2")).toBe("text-h2");
  });

  it("a última cor ainda vence a anterior", () => {
    expect(cn("text-danger", "text-success")).toBe("text-success");
  });
});
