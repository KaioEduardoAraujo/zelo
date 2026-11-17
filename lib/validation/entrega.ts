import { z } from "zod";

import { flattenIssues } from "@/lib/validation/errors";

// No envio, o servidor grava o SHA-256 de cada foto no documento: o hash da versão cobre as fotos.

export const FOTOS_MAX = 6;
export const CHECKLIST_MAX = 30;
export const VALIDADE_ENTREGA_PADRAO_DIAS = 15;
export const FOTO_BYTES_MAX = 2 * 1024 * 1024;

export const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoImagem = (typeof TIPOS_IMAGEM)[number];
export const EXTENSAO: Record<TipoImagem, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CAMINHO_FOTO = new RegExp(`^(${UUID})/(${UUID})/${UUID}\\.(jpg|png|webp)$`);

// Só vale na pasta deste prestador e desta entrega: um caminho forjado não pode expor
// o arquivo de outra pessoa.
export function caminhoFotoValido(path: string, prestadorId: string, propostaId: string): boolean {
  const m = CAMINHO_FOTO.exec(path);
  return !!m && m[1] === prestadorId && m[2] === propostaId;
}

// Pelos bytes, não pela extensão nem pelo Content-Type.
export function tipoPelosBytes(b: Uint8Array): TipoImagem | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return "image/png";
  if (
    b.length >= 12 &&
    String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" &&
    String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP"
  )
    return "image/webp";
  return null;
}

export type FotoEntrega = {
  path: string;
  nome: string;
  sha256?: string;
  bytes?: number;
  tipo?: TipoImagem;
};

export type ItemChecklist = { texto: string; feito: boolean };

export type ConteudoEntrega = {
  resumo: string;
  checklist: ItemChecklist[];
  fotos: FotoEntrega[];
  observacoes?: string;
  validade_dias: number;
};

export function entregaVazia(): ConteudoEntrega {
  return {
    resumo: "",
    checklist: [],
    fotos: [],
    validade_dias: VALIDADE_ENTREGA_PADRAO_DIAS,
  };
}

const texto = (min: number, max: number, mensagem: string) =>
  z.string().trim().min(min, mensagem).max(max, `Use no máximo ${max} caracteres.`);

const fotoBase = {
  path: z.string().regex(CAMINHO_FOTO, "Foto inválida. Remova e anexe de novo."),
  nome: texto(1, 120, "Foto sem nome."),
};

export const entregaSchema = z
  .object({
    resumo: texto(10, 4000, "Descreva o que foi entregue (pelo menos 10 caracteres)."),
    checklist: z
      .array(
        z.object({
          texto: texto(2, 200, "Descreva o item ou remova a linha."),
          feito: z.literal(true, "Marque como entregue ou remova o item."),
        }),
      )
      .min(1, "Inclua pelo menos um item no checklist.")
      .max(CHECKLIST_MAX, `No máximo ${CHECKLIST_MAX} itens.`),
    fotos: z.array(z.object(fotoBase)).max(FOTOS_MAX, `No máximo ${FOTOS_MAX} fotos.`),
    observacoes: texto(0, 2000, "").optional(),
    validade_dias: z
      .number("Informe a validade em dias.")
      .int("Use um número inteiro de dias.")
      .min(1, "A validade mínima é de 1 dia.")
      .max(90, "A validade máxima é de 90 dias."),
  })
  .strict();

export const entregaSeladaSchema = entregaSchema.extend({
  fotos: z
    .array(
      z.object({
        ...fotoBase,
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        bytes: z.number().int().positive().max(FOTO_BYTES_MAX),
        tipo: z.enum(TIPOS_IMAGEM),
      }),
    )
    .max(FOTOS_MAX),
});

export type EntregaSelada = z.infer<typeof entregaSeladaSchema>;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function normalizarEntrega(entrada: unknown): ConteudoEntrega {
  const raw = isRecord(entrada) ? entrada : {};

  const checklist = (Array.isArray(raw.checklist) ? raw.checklist : [])
    .filter(isRecord)
    .map((i) => ({ texto: str(i.texto), feito: i.feito === true }));

  const fotos: FotoEntrega[] = (Array.isArray(raw.fotos) ? raw.fotos : [])
    .filter(isRecord)
    .map((f) => {
      const foto: FotoEntrega = { path: str(f.path), nome: str(f.nome) };
      if (
        typeof f.sha256 === "string" &&
        /^[0-9a-f]{64}$/.test(f.sha256) &&
        typeof f.bytes === "number" &&
        Number.isInteger(f.bytes) &&
        (TIPOS_IMAGEM as readonly unknown[]).includes(f.tipo)
      ) {
        foto.sha256 = f.sha256;
        foto.bytes = f.bytes;
        foto.tipo = f.tipo as TipoImagem;
      }
      return foto;
    })
    .filter((f) => f.path !== "");

  const observacoes = str(raw.observacoes);
  return {
    resumo: str(raw.resumo),
    checklist,
    fotos,
    ...(observacoes ? { observacoes } : {}),
    validade_dias:
      typeof raw.validade_dias === "number" && Number.isFinite(raw.validade_dias)
        ? raw.validade_dias
        : VALIDADE_ENTREGA_PADRAO_DIAS,
  };
}

export function semSelo(c: ConteudoEntrega): ConteudoEntrega {
  return { ...c, fotos: c.fotos.map(({ path, nome }) => ({ path, nome })) };
}

export function validarEntrega(conteudo: ConteudoEntrega): Record<string, string> {
  const r = entregaSchema.safeParse(
    normalizarEntrega({
      ...conteudo,
      fotos: conteudo.fotos.map(({ path, nome }) => ({ path, nome })),
    }),
  );
  return r.success ? {} : flattenIssues(r.error);
}
