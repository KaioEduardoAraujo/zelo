import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/zelo/empty-state";
import { FormMessage } from "@/components/zelo/form-message";
import { PageHeader } from "@/components/zelo/page-header";
import { ProposalCard, type ProposalSummary } from "@/components/zelo/proposal-card";
import { StatusBadge } from "@/components/zelo/status-badge";
import { requirePrestador } from "@/lib/auth/dal";
import { formatCentavos, formatRelative } from "@/lib/format";
import { lerFiltros, urlListagem, type FiltrosListagem } from "@/lib/proposals/search";
import { listarPropostas, temPropostas } from "@/lib/proposals/queries";
import { STATUS, STATUS_ORDER } from "@/lib/status";
import { textosDe } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Propostas" };

export default async function PropostasPage(props: PageProps<"/propostas">) {
  await requirePrestador();
  const params = await props.searchParams;
  const filtros = lerFiltros(params);

  const [{ itens, total, paginas }, existe] = await Promise.all([
    listarPropostas(filtros),
    temPropostas(),
  ]);
  if (filtros.pagina > paginas)
    redirect(urlListagem("/propostas", { ...filtros, pagina: paginas }));

  const novaProposta = (
    <Button asChild>
      <Link href="/propostas/nova">Nova proposta</Link>
    </Button>
  );

  return (
    <>
      <PageHeader title="Propostas" action={novaProposta} />

      {params.excluida === "1" && (
        <FormMessage tone="success" className="mb-6">
          Rascunho excluído.
        </FormMessage>
      )}

      {!existe ? (
        <EmptyState
          title="Nenhuma proposta por aqui ainda."
          description="Crie a primeira em 2 minutos a partir de um modelo do seu ramo."
          action={{ label: "Criar a primeira proposta", href: "/propostas/nova" }}
        />
      ) : (
        <>
          <Filtros filtros={filtros} />

          <p className="mt-5 mb-3 text-support text-slate-600" aria-live="polite">
            {total === 0
              ? "Nenhuma proposta encontrada."
              : `${total} ${total === 1 ? "proposta" : "propostas"}${filtros.status ? ` · ${STATUS[filtros.status].label}` : ""}`}
          </p>

          {total === 0 ? (
            <EmptyState
              title="Nenhuma proposta encontrada."
              description="Tente outro nome ou título, ou limpe os filtros."
              action={{ label: "Limpar filtros", href: "/propostas" }}
            />
          ) : (
            <>
              <ul className="grid gap-3 md:hidden">
                {itens.map((p) => (
                  <li key={p.id} className="min-w-0">
                    <ProposalCard proposal={p} />
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <TabelaPropostas itens={itens} />
              </div>
              {paginas > 1 && <Paginacao filtros={filtros} paginas={paginas} />}
            </>
          )}
        </>
      )}
    </>
  );
}

function Filtros({ filtros }: { filtros: FiltrosListagem }) {
  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        action="/propostas"
        method="get"
        className="flex max-w-xl items-end gap-2"
      >
        {filtros.status && <input type="hidden" name="status" value={filtros.status} />}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="busca">Buscar por cliente ou título</Label>
          <Input
            id="busca"
            name="q"
            type="search"
            defaultValue={filtros.q}
            maxLength={80}
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <nav aria-label="Filtrar por status">
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
          {[null, ...STATUS_ORDER].map((status) => {
            const ativo = filtros.status === status;
            return (
              <li key={status ?? "todas"}>
                <Link
                  href={urlListagem("/propostas", { q: filtros.q, status })}
                  aria-current={ativo ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-pill)] border px-4 text-support font-semibold whitespace-nowrap transition-colors duration-150",
                    ativo
                      ? "border-navy-800 bg-navy-800 text-white"
                      : "border-line-strong bg-surface text-navy-700 hover:bg-surface-2",
                  )}
                >
                  {status ? STATUS[status].label : "Todas"}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function TabelaPropostas({ itens }: { itens: ProposalSummary[] }) {
  return (
    <Table>
      <TableCaption>Suas propostas, da mais recente para a mais antiga</TableCaption>
      <TableHeader>
        <TableRow className="h-11 hover:bg-transparent">
          <TableHead>Cliente</TableHead>
          <TableHead>Proposta</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="text-right">Atualizada</TableHead>
          <TableHead>
            <span className="sr-only">Ação</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {itens.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="max-w-48 truncate font-semibold">{p.clienteNome}</TableCell>
            <TableCell className="max-w-72">
              <Link
                href={`/propostas/${p.id}`}
                className="line-clamp-2 rounded-sm text-navy-900 underline-offset-4 hover:underline"
              >
                {p.titulo}
              </Link>
              {p.tipo && p.tipo !== "proposta" && (
                <span className="mt-0.5 block text-label text-slate-600">
                  {textosDe(p.tipo).rotulo}
                </span>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge status={p.status} />
            </TableCell>
            <TableCell className="tabular text-right">
              {p.valorCentavos === null ? "—" : formatCentavos(p.valorCentavos)}
            </TableCell>
            <TableCell className="text-right whitespace-nowrap text-slate-600">
              {formatRelative(p.atualizadoEm)}
            </TableCell>
            <TableCell className="text-right">
              <Button asChild variant="ghost" size="sm">
                <Link
                  href={
                    p.status === "rascunho"
                      ? `/propostas/${p.id}/editar?etapa=2`
                      : `/propostas/${p.id}`
                  }
                >
                  {p.status === "rascunho" ? "Continuar" : "Abrir"}
                  <span className="sr-only"> {p.titulo}</span>
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Paginacao({ filtros, paginas }: { filtros: FiltrosListagem; paginas: number }) {
  const { pagina } = filtros;
  return (
    <nav aria-label="Paginação" className="mt-6 flex items-center justify-between gap-3">
      {pagina > 1 ? (
        <Button asChild variant="secondary">
          <Link href={urlListagem("/propostas", { ...filtros, pagina: pagina - 1 })}>Anterior</Link>
        </Button>
      ) : (
        <span />
      )}
      <p className="text-support text-slate-600">
        Página {pagina} de {paginas}
      </p>
      {pagina < paginas ? (
        <Button asChild variant="secondary">
          <Link href={urlListagem("/propostas", { ...filtros, pagina: pagina + 1 })}>Próxima</Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
