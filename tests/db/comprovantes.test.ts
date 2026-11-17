import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { anonClient, criarUsuario, serviceClient, type Usuario } from "./helpers";

let a: Usuario;
let b: Usuario;
const caminho = () => `${a.id}/${randomUUID()}.pdf`;
const pdfFalso = Buffer.from("%PDF-1.7\n% teste\n");

beforeAll(async () => {
  a = await criarUsuario("Andrade Reformas");
  b = await criarUsuario("Bruno Instalações");
});

describe("bucket comprovantes", () => {
  it("o servidor grava; não sobrescreve um comprovante já guardado", async () => {
    const c = caminho();
    const svc = serviceClient().storage.from("comprovantes");
    const r1 = await svc.upload(c, pdfFalso, { contentType: "application/pdf", upsert: false });
    expect(r1.error).toBeNull();
    const r2 = await svc.upload(c, Buffer.from("%PDF-outro"), {
      contentType: "application/pdf",
      upsert: false,
    });
    expect(r2.error).not.toBeNull();
  });

  it("o dono lê o seu; outro prestador e visitante não leem", async () => {
    const c = caminho();
    await serviceClient()
      .storage.from("comprovantes")
      .upload(c, pdfFalso, { contentType: "application/pdf" });

    const dono = await a.client.storage.from("comprovantes").download(c);
    expect(dono.error).toBeNull();

    const outro = await b.client.storage.from("comprovantes").download(c);
    expect(outro.data).toBeNull();
    const assinadoOutro = await b.client.storage.from("comprovantes").createSignedUrl(c, 60);
    expect(assinadoOutro.data).toBeNull();

    const visitante = await anonClient().storage.from("comprovantes").download(c);
    expect(visitante.data).toBeNull();
  });

  it("prestador não grava nem apaga comprovantes (nem na própria pasta)", async () => {
    const c = caminho();
    const up = await a.client.storage
      .from("comprovantes")
      .upload(c, pdfFalso, { contentType: "application/pdf" });
    expect(up.error).not.toBeNull();

    await serviceClient()
      .storage.from("comprovantes")
      .upload(c, pdfFalso, { contentType: "application/pdf" });
    await a.client.storage.from("comprovantes").remove([c]);
    const aindaLa = await serviceClient().storage.from("comprovantes").download(c);
    expect(aindaLa.error).toBeNull();
  });

  it("só aceita PDF", async () => {
    const r = await serviceClient()
      .storage.from("comprovantes")
      .upload(`${a.id}/${randomUUID()}.png`, Buffer.from("x"), { contentType: "image/png" });
    expect(r.error).not.toBeNull();
  });
});
