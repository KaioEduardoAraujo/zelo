import { describe, expect, it } from "vitest";

import { UNIDADE_OUTRA, UNIDADES } from "@/lib/unidades";
import { itemSchema } from "@/lib/validation/proposta";

describe("UNIDADES", () => {
  it("inclui dúzia, dezena, centena e milhar", () => {
    const valores = UNIDADES.map((u) => u.valor);
    expect(valores).toEqual(expect.arrayContaining(["dúzia", "dezena", "centena", "milhar"]));
  });

  it("mostra quantas unidades cada uma representa", () => {
    const rotulo = (v: string) => UNIDADES.find((u) => u.valor === v)?.rotulo;
    expect(rotulo("dúzia")).toBe("dúzia (12)");
    expect(rotulo("dezena")).toBe("dezena (10)");
    expect(rotulo("centena")).toBe("centena (100)");
    expect(rotulo("milhar")).toBe("milhar (1.000)");
  });

  it("não repete valores e nenhum valor é o marcador interno de 'Outra…'", () => {
    const valores = UNIDADES.map((u) => u.valor);
    expect(new Set(valores).size).toBe(valores.length);
    expect(valores).not.toContain(UNIDADE_OUTRA);
  });

  it.each(UNIDADES.map((u) => u.valor))("a unidade %j é aceita pelo schema do item", (unidade) => {
    const r = itemSchema.safeParse({
      descricao: "Item de teste",
      unidade,
      quantidade: 1,
      valor_unitario_centavos: 100,
    });
    expect(r.success).toBe(true);
  });
});
