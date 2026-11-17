import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/zelo/confirm-dialog";
import { FormMessage } from "@/components/zelo/form-message";
import { PageHeader } from "@/components/zelo/page-header";
import { alternarModeloGlobal, criarModeloGlobal, excluirModeloGlobal } from "@/lib/admin/actions";
import { listarModelosGlobais } from "@/lib/admin/queries";
import { formatCentavos } from "@/lib/format";
import { NICHOS } from "@/lib/nichos";

export const metadata: Metadata = { title: "Templates globais" };

const ERROS: Record<string, string> = {
  criar: "Não conseguimos criar o modelo agora.",
  alternar: "Não conseguimos alterar o modelo agora.",
  excluir: "Não conseguimos excluir o modelo agora.",
  incompleto:
    "Preencha o modelo por completo antes de ativá-lo: é com ele que os prestadores começam.",
};

export default async function TemplatesGlobaisPage(props: PageProps<"/admin/templates">) {
  const sp = await props.searchParams;
  const modelos = await listarModelosGlobais();
  const erro = typeof sp.erro === "string" ? ERROS[sp.erro] : undefined;

  return (
    <>
      <PageHeader
        showTitleOnMobile
        title="Templates globais"
        description="Modelos do Zelo, visíveis a todos os prestadores quando ativos. Propostas já criadas guardam uma cópia e não mudam."
      />
      {sp.excluido === "1" && (
        <FormMessage tone="success" className="mb-6">
          Modelo excluído.
        </FormMessage>
      )}
      {erro && (
        <FormMessage tone="error" className="mb-6">
          {erro}
        </FormMessage>
      )}

      <form action={criarModeloGlobal} className="mb-6">
        <Button type="submit">Novo modelo</Button>
      </form>

      <ul className="grid gap-3 md:grid-cols-2">
        {modelos.map((m) => (
          <li key={m.id} className="min-w-0">
            <article className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5">
              <p className="text-label text-slate-600">
                {NICHOS[m.nicho]} · {m.ativo ? "✓ Ativo" : "✕ Inativo"}
              </p>
              <h2 className="mt-1 text-h3 break-words text-navy-950">{m.titulo}</h2>
              <p className="mt-1 line-clamp-2 text-support text-slate-600">{m.conteudo.escopo}</p>
              <p className="tabular mt-2 text-support font-semibold text-navy-900">
                {formatCentavos(m.conteudo.valor_total_centavos)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="secondary">
                  <Link href={`/admin/templates/${m.id}/editar`}>
                    Editar<span className="sr-only"> {m.titulo}</span>
                  </Link>
                </Button>
                <form action={alternarModeloGlobal.bind(null, m.id, !m.ativo)}>
                  <Button type="submit" variant="secondary">
                    {m.ativo ? "Desativar" : "Ativar"}
                    <span className="sr-only"> {m.titulo}</span>
                  </Button>
                </form>
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost">
                      Excluir<span className="sr-only"> {m.titulo}</span>
                    </Button>
                  }
                  title="Excluir este modelo?"
                  description={`O modelo “${m.titulo}” deixa de existir para todos. As propostas criadas com ele não mudam.`}
                  confirmLabel="Excluir modelo"
                  onConfirm={excluirModeloGlobal.bind(null, m.id)}
                />
              </div>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
