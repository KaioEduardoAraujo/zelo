import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { hashDocumento } from "@/lib/crypto/hash";

import {
  anonClient,
  criarAceita,
  criarRascunho,
  criarUsuario,
  hashAleatorio,
  serviceClient,
  type Usuario,
} from "./helpers";

let a: Usuario;
let b: Usuario;

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const caminho = (dono: Usuario, propostaId: string = randomUUID()) =>
  `${dono.id}/${propostaId}/${randomUUID()}.png`;

beforeAll(async () => {
  a = await criarUsuario("Andrade Reformas");
  b = await criarUsuario("Bruno Instalações");
});

describe("bucket entregas", () => {
  it("o prestador envia e lê as fotos da própria pasta", async () => {
    const c = caminho(a);
    const up = await a.client.storage
      .from("entregas")
      .upload(c, PNG_1x1, { contentType: "image/png" });
    expect(up.error).toBeNull();

    const lido = await a.client.storage.from("entregas").download(c);
    expect(lido.error).toBeNull();
    const url = await a.client.storage.from("entregas").createSignedUrls([c], 60);
    expect(url.data?.[0]?.signedUrl).toBeTruthy();
  });

  it("não envia para a pasta de outro prestador", async () => {
    const r = await b.client.storage
      .from("entregas")
      .upload(caminho(a), PNG_1x1, { contentType: "image/png" });
    expect(r.error).not.toBeNull();
  });

  it("outro prestador e visitante não leem nem assinam a foto", async () => {
    const c = caminho(a);
    await a.client.storage.from("entregas").upload(c, PNG_1x1, { contentType: "image/png" });

    expect((await b.client.storage.from("entregas").download(c)).data).toBeNull();
    const assinada = await b.client.storage.from("entregas").createSignedUrls([c], 60);
    expect(assinada.data?.[0]?.signedUrl ?? null).toBeNull();
    expect((await anonClient().storage.from("entregas").download(c)).data).toBeNull();
  });

  it("a foto anexada não pode ser trocada nem apagada pelo prestador", async () => {
    const c = caminho(a);
    await a.client.storage.from("entregas").upload(c, PNG_1x1, { contentType: "image/png" });

    const troca = await a.client.storage
      .from("entregas")
      .upload(c, Buffer.from("outra coisa"), { contentType: "image/png", upsert: true });
    expect(troca.error).not.toBeNull();

    await a.client.storage.from("entregas").remove([c]);
    const ainda = await serviceClient().storage.from("entregas").download(c);
    expect(ainda.error).toBeNull();
    expect(Buffer.from(await ainda.data!.arrayBuffer()).equals(PNG_1x1)).toBe(true);
  });

  it("só aceita JPEG, PNG e WebP", async () => {
    const r = await a.client.storage
      .from("entregas")
      .upload(`${a.id}/${randomUUID()}/${randomUUID()}.svg`, Buffer.from("<svg/>"), {
        contentType: "image/svg+xml",
      });
    expect(r.error).not.toBeNull();
  });

  it("o bucket não é público", async () => {
    const { data } = await serviceClient().storage.getBucket("entregas");
    expect(data?.public).toBe(false);
  });
});

describe("entrega como proposta derivada", () => {
  const novaEntrega = (dono: Usuario, paiId: string) =>
    dono.client
      .from("propostas")
      .insert({
        prestador_id: dono.id,
        tipo: "entrega",
        proposta_pai_id: paiId,
        cliente_nome: "Mariana Costa",
        cliente_email: "mariana@example.com",
        titulo: "Entrega: Troca de tela",
      })
      .select("id")
      .single();

  it("nasce de uma proposta aceita do mesmo prestador", async () => {
    const aceita = await criarAceita(a);
    const { data, error } = await novaEntrega(a, aceita.propostaId);
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();

    const intruso = await novaEntrega(b, aceita.propostaId);
    expect(intruso.error?.message).toMatch(/proposta aceita do mesmo prestador/);
  });

  it("não nasce de rascunho, nem de outra entrega ou aditivo", async () => {
    const { proposta: rascunho } = await criarRascunho(a);
    expect((await novaEntrega(a, rascunho.id)).error?.message).toMatch(/proposta aceita/);

    const aceita = await criarAceita(a);
    const { data: entrega } = await novaEntrega(a, aceita.propostaId);
    // O pai de um derivado precisa ser uma PROPOSTA (não uma entrega).
    expect((await novaEntrega(a, entrega!.id)).error?.message).toMatch(/proposta aceita/);
  });

  it("a entrega é enviada pela mesma função e o documento sela as fotos e a referência", async () => {
    const aceita = await criarAceita(a);
    const { data: entrega } = await novaEntrega(a, aceita.propostaId);
    const id = entrega!.id;
    const svc = serviceClient();

    await a.client.from("proposta_versoes").insert({
      proposta_id: id,
      numero: 1,
      conteudo: { resumo: "rascunho", checklist: [], fotos: [], validade_dias: 15 },
    });

    const documento = {
      resumo: "Troca de tela concluída, com testes de touch, câmera e Face ID.",
      checklist: [{ texto: "Tela trocada", feito: true }],
      fotos: [
        {
          path: caminho(a, id),
          nome: "tela.png",
          sha256: hashAleatorio(),
          bytes: PNG_1x1.length,
          tipo: "image/png",
        },
      ],
      validade_dias: 15,
      proposta_id: id,
      versao: 1,
      titulo: "Entrega: Troca de tela",
      prestador: { nome: "Andrade Reformas", empresa: null },
      cliente: { nome: "Mariana Costa", email: "mariana@example.com", telefone: null },
      referencia: {
        proposta_id: aceita.propostaId,
        titulo: "Troca de tela iPhone 12",
        hash_documento: aceita.hash,
      },
    };
    const hash = hashDocumento(documento);
    const { data, error } = await a.client
      .rpc("enviar_versao", {
        p_proposta_id: id,
        p_documento: documento as never,
        p_hash: hash,
        p_token_hash: hashAleatorio(),
      })
      .single();
    expect(error).toBeNull();
    expect(data?.r_numero).toBe(1);

    // Relido do jsonb, o hash continua o mesmo (fotos e referência incluídas)
    const { data: v } = await svc
      .from("proposta_versoes")
      .select("conteudo, hash_sha256, enviada_em")
      .eq("proposta_id", id)
      .single();
    expect(v?.enviada_em).not.toBeNull();
    expect(hashDocumento(v!.conteudo)).toBe(hash);

    const edita = await a.client
      .from("proposta_versoes")
      .update({ conteudo: { ...documento, resumo: "outro" } })
      .eq("proposta_id", id)
      .select("id");
    expect(edita.data ?? []).toHaveLength(0);
  });
});
