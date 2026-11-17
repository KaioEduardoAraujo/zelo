import { FOTO_BYTES_MAX } from "@/lib/validation/entrega";

export const LADO_MAXIMO = 1600;
const QUALIDADES = [0.8, 0.65, 0.5];

export function dimensoesAlvo(
  largura: number,
  altura: number,
  maximo = LADO_MAXIMO,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= maximo) return { largura, altura };
  const fator = maximo / maior;
  return {
    largura: Math.max(1, Math.round(largura * fator)),
    altura: Math.max(1, Math.round(altura * fator)),
  };
}

export function nomeJpeg(nome: string): string {
  const base = nome.replace(/\.[^./\\]+$/, "").trim() || "foto";
  return `${base.slice(0, 100)}.jpg`;
}

export class ImagemInvalidaError extends Error {}

function paraBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
}

export async function comprimirImagem(arquivo: File): Promise<{ blob: Blob; nome: string }> {
  if (!arquivo.type.startsWith("image/")) {
    throw new ImagemInvalidaError("Este arquivo não é uma imagem.");
  }

  let bitmap: ImageBitmap;
  try {
    // from-image respeita a rotação gravada pela câmera.
    bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    throw new ImagemInvalidaError(
      "Não conseguimos abrir esta imagem. Use uma foto em JPG, PNG ou WebP.",
    );
  }

  try {
    let escala = 1;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const alvo = dimensoesAlvo(
        Math.round(bitmap.width * escala),
        Math.round(bitmap.height * escala),
      );
      const canvas = document.createElement("canvas");
      canvas.width = alvo.largura;
      canvas.height = alvo.altura;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ImagemInvalidaError("Seu navegador não conseguiu preparar a foto.");
      // Fundo branco: a transparência do PNG viraria preto no JPEG.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await paraBlob(canvas, QUALIDADES[tentativa]);
      if (blob && blob.size <= FOTO_BYTES_MAX) return { blob, nome: nomeJpeg(arquivo.name) };
      escala *= 0.75;
    }
  } finally {
    bitmap.close();
  }
  throw new ImagemInvalidaError("A foto continua grande demais mesmo reduzida. Tente outra.");
}
