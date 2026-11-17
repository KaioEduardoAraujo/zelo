import { NextResponse } from "next/server";

import { linkDoComprovante } from "@/lib/comprovante/servico";
import { origemDaRequisicao } from "@/lib/http/origem";
import { dentroDoLimite } from "@/lib/publico/limites";
import { carregarPropostaPublica } from "@/lib/publico/queries";

// O token é conferido de novo aqui. Redireciona para uma URL assinada de 60 s (bucket privado).

const naoEncontrado = () =>
  new NextResponse("Comprovante não encontrado.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

export async function GET(_req: Request, ctx: RouteContext<"/p/[token]/comprovante">) {
  const { token } = await ctx.params;

  const origem = await origemDaRequisicao();
  if (!(await dentroDoLimite("comprovante", origem.ip, 20, 600))) {
    return new NextResponse("Muitas tentativas seguidas. Espere alguns minutos.", {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const proposta = await carregarPropostaPublica(token);
  const r = proposta?.resposta;
  if (!proposta || proposta.estado !== "aceita" || r?.resultado !== "aceito")
    return naoEncontrado();

  let url: string | null = null;
  try {
    url = await linkDoComprovante({ id: r.aceiteId, pdfPath: r.pdfPath, codigo: r.codigo });
  } catch {
    url = null;
  }
  if (!url) {
    return new NextResponse("Não conseguimos preparar o comprovante agora. Tente de novo.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.redirect(url, 303);
}
