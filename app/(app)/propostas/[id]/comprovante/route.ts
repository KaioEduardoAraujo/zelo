import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePrestador } from "@/lib/auth/dal";
import { linkDoComprovante } from "@/lib/comprovante/servico";
import { createClient } from "@/lib/supabase/server";

// Route Handlers não passam pelo layout: a sessão é conferida aqui. O RLS só devolve aceites
// do próprio prestador.

const naoEncontrado = () =>
  new NextResponse("Comprovante não encontrado.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

export async function GET(_req: Request, ctx: RouteContext<"/propostas/[id]/comprovante">) {
  await requirePrestador();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return naoEncontrado();

  const supabase = await createClient();
  const { data: aceite } = await supabase
    .from("aceites")
    .select("id, pdf_path, codigo_comprovante, proposta_versoes!inner(proposta_id)")
    .eq("proposta_versoes.proposta_id", id)
    .eq("resultado", "aceito")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!aceite) return naoEncontrado();

  let url: string | null = null;
  try {
    url = await linkDoComprovante({
      id: aceite.id,
      pdfPath: aceite.pdf_path,
      codigo: aceite.codigo_comprovante,
    });
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
