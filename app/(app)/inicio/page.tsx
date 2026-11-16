import { Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/zelo/empty-state";
import { FormMessage } from "@/components/zelo/form-message";
import { PageHeader } from "@/components/zelo/page-header";
import { ProposalCard } from "@/components/zelo/proposal-card";
import { StatTile } from "@/components/zelo/stat-tile";
import { StatusBadge } from "@/components/zelo/status-badge";
import { requirePrestador } from "@/lib/auth/dal";
import { formatCentavos } from "@/lib/format";
import { precisaDeAtencao, propostasRecentes, resumoPainel } from "@/lib/proposals/queries";

export const metadata: Metadata = { title: "Início" };

export default async function InicioPage(props: PageProps<"/inicio">) {
  const profile = await requirePrestador();
  const { senha } = await props.searchParams;

  const [resumo, atencao, recentes] = await Promise.all([
    resumoPainel(),
    precisaDeAtencao(),
    propostasRecentes(),
  ]);

  return (
    <>
      {senha === "redefinida" && (
        <FormMessage tone="success" className="mb-6">
          Senha alterada. Use a nova senha no próximo acesso.
        </FormMessage>
      )}
      <PageHeader
        showTitleOnMobile
        title={`Olá, ${profile.nome.split(" ")[0]}`}
        description="Acompanhe o que seus clientes já aceitaram."
      />

      {recentes.length === 0 ? (
        <EmptyState
          title="Nenhuma proposta por aqui ainda."
          description="Crie a primeira em 2 minutos a partir de um modelo do seu ramo."
          action={{ label: "Criar a primeira proposta", href: "/propostas/nova" }}
        />
      ) : (
        <div className="flex flex-col gap-10">
          <section aria-label="Resumo" className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label="Aguardando resposta"
              value={String(resumo.aguardando)}
              hint="Enviadas e ainda dentro da validade"
            />
            <StatTile label="Aceitas no mês" value={String(resumo.aceitasMes)} />
            <StatTile
              label="Valor aceito no mês"
              value={formatCentavos(resumo.valorAceitoMesCentavos)}
            />
          </section>

          <section aria-labelledby="atencao-titulo">
            <h2 id="atencao-titulo" className="mb-3 text-h2 text-navy-950">
              Precisa de atenção
            </h2>
            {atencao.length === 0 ? (
              <p className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-4 text-support text-slate-600">
                Nada pendente por enquanto. Quando um cliente pedir ajuste, ou uma proposta estiver
                perto de vencer sem resposta, ela aparece aqui.
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {atencao.map(({ proposta, atencao: a }) => (
                  <li key={proposta.id} className="min-w-0">
                    <Link
                      href={`/propostas/${proposta.id}`}
                      className="block h-full rounded-[var(--radius-card)] border border-warning/30 bg-warning-bg px-4 py-3.5 transition-colors hover:border-warning/60"
                    >
                      <p className="flex items-center gap-1.5 text-support font-semibold text-warning">
                        <Clock className="size-4 shrink-0" aria-hidden="true" />
                        {a.motivo}
                      </p>
                      <p className="mt-1 line-clamp-2 text-h3 break-words text-navy-950">
                        {proposta.titulo}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-support text-navy-700">
                          {proposta.clienteNome}
                        </p>
                        <StatusBadge status={proposta.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="recentes-titulo">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 id="recentes-titulo" className="text-h2 text-navy-950">
                Recentes
              </h2>
              <Link
                href="/propostas"
                className="rounded-sm text-support font-semibold text-teal-600 underline-offset-4 hover:underline"
              >
                Ver todas
              </Link>
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              {recentes.map((p) => (
                <li key={p.id} className="min-w-0">
                  <ProposalCard proposal={p} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
