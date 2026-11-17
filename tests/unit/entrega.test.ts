import { describe, expect, it } from "vitest";

import { hashDocumento } from "@/lib/crypto/hash";
import { emailCodigo, emailComprovante } from "@/lib/email/templates";
import { prepararDocumentoEntrega } from "@/lib/entregas/envio";
import { dimensoesAlvo, nomeJpeg } from "@/lib/imagem";
import { mensagemWhatsApp, prepararDocumento } from "@/lib/proposals/envio";
import { lerSnapshot } from "@/lib/proposals/snapshot";
import { textoConsentimento } from "@/lib/publico/consentimento";
import { TEXTOS } from "@/lib/tipos";
import {
  caminhoFotoValido,
  normalizarEntrega,
  semSelo,
  tipoPelosBytes,
  validarEntrega,
} from "@/lib/validation/entrega";

const PRESTADOR = "11111111-1111-4111-8111-111111111111";
const PROPOSTA = "22222222-2222-4222-8222-222222222222";
const FOTO = `${PRESTADOR}/${PROPOSTA}/33333333-3333-4333-8333-333333333333.jpg`;
const FOTO2 = `${PRESTADOR}/${PROPOSTA}/44444444-4444-4444-8444-444444444444.png`;

const REF = {
  proposta_id: "55555555-5555-4555-8555-555555555555",
  titulo: "Reforma do banheiro",
  hash_documento: "a".repeat(64),
};

const conteudoOk = {
  resumo: "Troca do piso e revestimento concluída, com rejunte e limpeza final.",
  checklist: [
    { texto: "Piso assentado", feito: true },
    { texto: "Revestimento das paredes", feito: true },
  ],
  fotos: [{ path: FOTO, nome: "banheiro.jpg" }],
  validade_dias: 15,
};

const seladas = [
  { path: FOTO, nome: "banheiro.jpg", sha256: "b".repeat(64), bytes: 120_000, tipo: "image/jpeg" },
];

const entrada = {
  propostaId: PROPOSTA,
  versao: 1,
  titulo: "Entrega: Reforma do banheiro",
  clienteNome: "Mariana Costa",
  clienteEmail: "mariana@example.com",
  clienteTelefone: null,
  prestadorNome: "Carlos Andrade",
  prestadorEmpresa: "Andrade Reformas",
  conteudo: conteudoOk,
  referencia: REF,
  fotosSeladas: seladas,
};

describe("caminho das fotos", () => {
  it("só vale na pasta do prestador e da entrega", () => {
    expect(caminhoFotoValido(FOTO, PRESTADOR, PROPOSTA)).toBe(true);
    expect(caminhoFotoValido(FOTO, "99999999-9999-4999-8999-999999999999", PROPOSTA)).toBe(false);
    expect(caminhoFotoValido(FOTO, PRESTADOR, "99999999-9999-4999-8999-999999999999")).toBe(false);
  });

  it("recusa travessia de pasta, extensão estranha e lixo", () => {
    expect(caminhoFotoValido(`${PRESTADOR}/${PROPOSTA}/../x.jpg`, PRESTADOR, PROPOSTA)).toBe(false);
    expect(
      caminhoFotoValido(`${PRESTADOR}/${PROPOSTA}/${"3".repeat(8)}.exe`, PRESTADOR, PROPOSTA),
    ).toBe(false);
    expect(caminhoFotoValido(FOTO.replace(".jpg", ".svg"), PRESTADOR, PROPOSTA)).toBe(false);
    expect(caminhoFotoValido("", PRESTADOR, PROPOSTA)).toBe(false);
    expect(caminhoFotoValido(`${FOTO}/extra`, PRESTADOR, PROPOSTA)).toBe(false);
  });
});

describe("tipo da imagem pelos bytes", () => {
  it("reconhece JPEG, PNG e WebP e recusa o resto", () => {
    expect(tipoPelosBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("image/jpeg");
    expect(
      tipoPelosBytes(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])),
    ).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(tipoPelosBytes(webp)).toBe("image/webp");
    expect(
      tipoPelosBytes(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")),
    ).toBe(null);
    expect(tipoPelosBytes(new TextEncoder().encode("MZ\x90\0 executável"))).toBe(null);
    expect(tipoPelosBytes(new Uint8Array())).toBe(null);
  });
});

describe("conteúdo da entrega", () => {
  it("conteúdo completo e todos os itens marcados é válido", () => {
    expect(validarEntrega(normalizarEntrega(conteudoOk))).toEqual({});
  });

  it("aponta resumo curto, checklist vazio e item não marcado, cada um no seu campo", () => {
    const erros = validarEntrega(
      normalizarEntrega({ ...conteudoOk, resumo: "curto", checklist: [] }),
    );
    expect(erros.resumo).toMatch(/pelo menos 10/);
    expect(erros.checklist).toMatch(/pelo menos um item/);

    const naoMarcado = validarEntrega(
      normalizarEntrega({ ...conteudoOk, checklist: [{ texto: "Piso", feito: false }] }),
    );
    expect(naoMarcado["checklist.0.feito"]).toMatch(/Marque como entregue/);
  });

  it("limita o número de fotos e valida o caminho", () => {
    const muitas = Array.from({ length: 7 }, (_, i) => ({
      path: `${PRESTADOR}/${PROPOSTA}/${String(i).repeat(8)}-0000-4000-8000-000000000000.jpg`,
      nome: `f${i}.jpg`,
    }));
    expect(validarEntrega(normalizarEntrega({ ...conteudoOk, fotos: muitas })).fotos).toMatch(
      /No máximo 6/,
    );
    const ruim = validarEntrega(
      normalizarEntrega({ ...conteudoOk, fotos: [{ path: "../../etc/passwd", nome: "x" }] }),
    );
    expect(ruim["fotos.0.path"]).toMatch(/Foto inválida/);
  });

  it("a validade vai de 1 a 90 dias", () => {
    expect(
      validarEntrega(normalizarEntrega({ ...conteudoOk, validade_dias: 0 })).validade_dias,
    ).toMatch(/mínima/);
    expect(
      validarEntrega(normalizarEntrega({ ...conteudoOk, validade_dias: 91 })).validade_dias,
    ).toMatch(/máxima/);
  });

  it("a leitura tolerante nunca lança e descarta chaves desconhecidas", () => {
    expect(normalizarEntrega(null)).toMatchObject({ resumo: "", checklist: [], fotos: [] });
    expect(normalizarEntrega("lixo")).toMatchObject({ resumo: "", checklist: [] });
    const c = normalizarEntrega({
      resumo: "  ok  ",
      checklist: [{ texto: " a ", feito: "sim", extra: 1 }, "x", null],
      fotos: [{ path: FOTO, nome: "f", sha256: "zz", extra: 1 }, { path: "" }],
      invasora: "<script>",
    });
    expect(c).toEqual({
      resumo: "ok",
      checklist: [{ texto: "a", feito: false }],
      fotos: [{ path: FOTO, nome: "f" }],
      validade_dias: 15,
    });
  });

  it("mantém os dados do selo só quando completos; semSelo os remove", () => {
    const comSelo = normalizarEntrega({
      ...conteudoOk,
      fotos: [{ ...seladas[0] }],
    });
    expect(comSelo.fotos[0]).toMatchObject({ sha256: "b".repeat(64), bytes: 120_000 });
    expect(semSelo(comSelo).fotos[0]).toEqual({ path: FOTO, nome: "banheiro.jpg" });
  });
});

describe("documento selado da entrega", () => {
  it("leva a referência à proposta, as fotos com SHA-256 e um hash estável", () => {
    const r = prepararDocumentoEntrega(entrada);
    if (!r.ok) throw new Error(JSON.stringify(r.erros));
    expect(r.documento.referencia).toEqual(REF);
    expect(r.documento.fotos[0].sha256).toBe("b".repeat(64));
    expect(r.documento.proposta_id).toBe(PROPOSTA);
    expect(r.hash).toBe(hashDocumento(r.documento));
    expect(r.documento.prestador).toEqual({ nome: "Carlos Andrade", empresa: "Andrade Reformas" });
  });

  it("trocar o conteúdo de UMA foto muda o hash do documento", () => {
    const a = prepararDocumentoEntrega(entrada);
    const b = prepararDocumentoEntrega({
      ...entrada,
      fotosSeladas: [{ ...seladas[0], sha256: "c".repeat(64) }],
    });
    if (!a.ok || !b.ok) throw new Error("deveria ser válido");
    expect(a.hash).not.toBe(b.hash);
  });

  it("recusa item não marcado, foto fora do rascunho e cliente incompleto", () => {
    const naoMarcado = prepararDocumentoEntrega({
      ...entrada,
      conteudo: { ...conteudoOk, checklist: [{ texto: "Piso", feito: false }] },
    });
    expect(naoMarcado.ok).toBe(false);

    const outraFoto = prepararDocumentoEntrega({
      ...entrada,
      fotosSeladas: [{ ...seladas[0], path: FOTO2 }],
    });
    expect(outraFoto.ok).toBe(false);
    if (!outraFoto.ok) expect(outraFoto.erros.fotos).toMatch(/mudaram/);

    expect(prepararDocumentoEntrega({ ...entrada, clienteEmail: "sem-arroba" }).ok).toBe(false);
  });

  it("o aditivo também sela a referência, e ela entra no hash", () => {
    const base = {
      propostaId: PROPOSTA,
      versao: 1,
      titulo: "Aditivo: Reforma",
      clienteNome: "Mariana Costa",
      clienteEmail: "mariana@example.com",
      clienteTelefone: null,
      prestadorNome: "Carlos",
      prestadorEmpresa: null,
      conteudo: {
        escopo: "Troca do registro do chuveiro, com vedação.",
        itens: [
          { descricao: "Registro", unidade: "un", quantidade: 1, valor_unitario_centavos: 9000 },
        ],
        exclusoes: [],
        valor_total_centavos: 9000,
        prazo: "1 dia",
        pagamento: "Pix",
        garantia: "90 dias",
        validade_dias: 7,
      },
    };
    const com = prepararDocumento({ ...base, referencia: REF });
    const sem = prepararDocumento(base);
    if (!com.ok || !sem.ok) throw new Error("deveria ser válido");
    expect(com.documento.referencia).toEqual(REF);
    expect(sem.documento.referencia).toBeUndefined();
    expect(com.hash).not.toBe(sem.hash);

    // e o retrato lido de volta traz a referência
    const snap = lerSnapshot(com.documento);
    expect(snap?.referencia).toEqual(REF);
    expect(lerSnapshot(sem.documento)?.referencia).toBeUndefined();
  });
});

describe("textos por tipo", () => {
  const p = { titulo: "Reforma", prestador: "Andrade Reformas", valorCentavos: 513_000 };

  it("a proposta mantém exatamente os textos da Fase 6", () => {
    expect(TEXTOS.proposta.principal).toBe("Aceitar proposta");
    expect(TEXTOS.proposta.folha.aceito).toBe("Confirmar aceite");
    expect(textoConsentimento("aceito", p)).toBe(
      textoConsentimento("aceito", { ...p, tipo: "proposta" }),
    );
    expect(textoConsentimento("aceito", p)).toContain(
      "Li a proposta “Reforma” de Andrade Reformas, no valor de R$ 5.130,00, e aceito",
    );
  });

  it("consentimento do aditivo cita o aditivo e o valor", () => {
    const t = textoConsentimento("aceito", { ...p, tipo: "aditivo" });
    expect(t).toContain("Li o aditivo “Reforma”");
    expect(t).toContain("R$ 5.130,00");
  });

  it("consentimento da entrega confirma o recebimento, sem valor, e diz a finalidade dos dados", () => {
    const t = textoConsentimento("aceito", { ...p, valorCentavos: null, tipo: "entrega" });
    expect(t).toContain("Confirmo que recebi a entrega do serviço “Reforma”");
    expect(t).toContain("checklist e as fotos");
    expect(t).not.toContain("R$");
    expect(t).toMatch(/CPF/);
    expect(textoConsentimento("recusado", { ...p, tipo: "entrega" })).toMatch(/^Recuso a entrega/);
    expect(textoConsentimento("ajuste", { ...p, tipo: "entrega" })).toMatch(/correção na entrega/);
  });

  it("e-mail do código diz para que serve, por tipo", () => {
    const base = { codigo: "123456", titulo: "Reforma", prestador: "Andrade", minutos: 10 };
    expect(emailCodigo({ ...base, acao: "aceito" }).texto).toContain(
      "aceitar a proposta “Reforma”",
    );
    expect(emailCodigo({ ...base, acao: "aceito", tipo: "aditivo" }).texto).toContain(
      "aceitar o aditivo “Reforma”",
    );
    expect(emailCodigo({ ...base, acao: "aceito", tipo: "entrega" }).texto).toContain(
      "confirmar o recebimento da entrega “Reforma”",
    );
    expect(emailCodigo({ ...base, acao: "ajuste", tipo: "entrega" }).texto).toContain(
      "pedir correção na entrega",
    );
  });

  it("e-mail do comprovante muda assunto e frase por tipo", () => {
    const base = {
      titulo: "Reforma",
      prestador: "Andrade",
      clienteNome: "Mariana",
      codigo: "ZL-4K7Q-92MD",
      registradoEm: "2026-11-16T17:32:00.000Z",
      urlVerificacao: "https://zelo.example/verificar",
      urlPainel: "https://zelo.example/propostas/1",
    };
    const e = emailComprovante({ ...base, para: "cliente", tipo: "entrega" });
    expect(e.assunto).toBe("Comprovante da confirmação de entrega: Reforma");
    expect(e.texto).toContain("Você confirmou o recebimento da entrega “Reforma”");
    expect(emailComprovante({ ...base, para: "prestador", tipo: "aditivo" }).assunto).toBe(
      "Aditivo aceito: Reforma",
    );
    expect(emailComprovante({ ...base, para: "prestador" }).assunto).toBe(
      "Proposta aceita: Reforma",
    );
  });

  it("mensagem do WhatsApp por tipo (a da proposta não muda)", () => {
    const r = {
      clienteNome: "Mariana Costa",
      prestadorNome: "Andrade",
      titulo: "Reforma",
      link: "https://zelo.example/p/ABC",
      validadeEm: "2026-12-01T16:12:00Z",
    };
    expect(mensagemWhatsApp({ ...r, tipo: "proposta", valorCentavos: 100_00 })).toContain(
      "Segue a proposta “Reforma”, no valor de R$ 100,00.",
    );
    expect(mensagemWhatsApp({ ...r, tipo: "aditivo", valorCentavos: 100_00 })).toContain(
      "Segue o aditivo “Reforma”, no valor de R$ 100,00.",
    );
    const entrega = mensagemWhatsApp({ ...r, tipo: "entrega", valorCentavos: null });
    expect(entrega).toContain("O serviço “Reforma” foi concluído");
    expect(entrega).toContain("confirmar o recebimento");
    expect(entrega).not.toContain("R$");
  });
});

describe("imagem: dimensões e nome", () => {
  it("reduz mantendo a proporção e nunca amplia", () => {
    expect(dimensoesAlvo(4000, 3000)).toEqual({ largura: 1600, altura: 1200 });
    expect(dimensoesAlvo(3000, 4000)).toEqual({ largura: 1200, altura: 1600 });
    expect(dimensoesAlvo(800, 600)).toEqual({ largura: 800, altura: 600 });
    expect(dimensoesAlvo(1, 100_000)).toEqual({ largura: 1, altura: 1600 });
  });

  it("nome com extensão trocada por .jpg", () => {
    expect(nomeJpeg("IMG 001.HEIC")).toBe("IMG 001.jpg");
    expect(nomeJpeg("sem-extensao")).toBe("sem-extensao.jpg");
    expect(nomeJpeg("")).toBe("foto.jpg");
    expect(nomeJpeg("a".repeat(300) + ".png").length).toBeLessThanOrEqual(104);
  });
});
