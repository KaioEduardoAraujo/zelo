import { describe, expect, it } from "vitest";

import { conteudoTemplateSchema } from "@/lib/validation/proposta";

import { serviceClient } from "./helpers";

describe("templates globais do seed", () => {
  it("existe um por nicho e todos seguem o schema da aplicação", async () => {
    const { data, error } = await serviceClient()
      .from("templates")
      .select("nicho, titulo, conteudo")
      .is("dono_id", null);
    expect(error).toBeNull();

    const nichos = new Set(data!.map((t) => t.nicho));
    expect(nichos).toEqual(
      new Set(["reforma", "assistencia_tecnica", "design", "agencia", "instalacao"]),
    );

    for (const t of data!) {
      const r = conteudoTemplateSchema.safeParse(t.conteudo);
      expect(r.success, `${t.titulo}: ${r.error?.message}`).toBe(true);
    }
  });
});
