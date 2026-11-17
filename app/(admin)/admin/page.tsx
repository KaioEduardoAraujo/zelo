import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/zelo/confirm-dialog";
import { FormMessage } from "@/components/zelo/form-message";
import { PageHeader } from "@/components/zelo/page-header";
import { alterarSituacaoPrestador } from "@/lib/admin/actions";
import { carregarPainelAdmin, lerFiltroPrestadores } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Administração" };

const OK: Record<string, string> = {
  suspenso:
    "Conta suspensa. O prestador não consegue mais entrar; os links já enviados continuam valendo.",
  reativado: "Conta reativada. O prestador já pode entrar de novo.",
};

export default async function AdminPage(props: PageProps<"/admin">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const filtro = lerFiltroPrestadores(sp);
  const { prestadores, totais } = await carregarPainelAdmin(filtro);
  const ok = typeof sp.ok === "string" ? OK[sp.ok] : undefined;

  return (
    <>
      <PageHeader
        showTitleOnMobile
        title="Administração"
        description="Contas de prestadores e números gerais. Aqui não aparece nem se altera o conteúdo de propostas e aceites."
      />

      {ok && (
        <FormMessage tone="success" className="mb-6">
          {ok}
        </FormMessage>
      )}
      {sp.erro === "situacao" && (
        <FormMessage tone="error" className="mb-6">
          Não conseguimos alterar a conta agora. Nada foi mudado; tente de novo.
        </FormMessage>
      )}

      <dl className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Prestadores", totais.prestadores],
          ["Contas ativas", totais.ativos],
          ["Contas suspensas", totais.suspensos],
          ["Propostas criadas", totais.propostas],
          ["Aceites registrados", totais.aceites],
        ].map(([rotulo, valor]) => (
          <div
            key={rotulo}
            className="rounded-[var(--radius-card)] border border-line bg-surface p-4"
          >
            <dt className="text-label text-slate-600">{rotulo}</dt>
            <dd className="tabular mt-1 text-h1 text-navy-950">{valor}</dd>
          </div>
        ))}
      </dl>

      <form
        method="get"
        role="search"
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="q" className="mb-1 block text-label text-slate-600">
            Buscar por nome, empresa ou e-mail
          </label>
          <Input id="q" name="q" defaultValue={filtro.q} maxLength={80} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="situacao" className="mb-1 block text-label text-slate-600">
            Situação
          </label>
          <NativeSelect id="situacao" name="situacao" defaultValue={filtro.situacao}>
            <option value="todos">Todas</option>
            <option value="ativos">Ativas</option>
            <option value="suspensos">Suspensas</option>
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <Table>
          <TableCaption className="sr-only">Prestadores cadastrados</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Prestador</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead className="text-right">Propostas</TableHead>
              <TableHead className="text-right">Aceites</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prestadores.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-slate-600">
                  Nenhum prestador encontrado.
                </TableCell>
              </TableRow>
            )}
            {prestadores.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <p className="font-semibold">{p.nome}</p>
                  {p.empresa && <p className="text-support text-slate-600">{p.empresa}</p>}
                  <p className="text-label text-slate-600">Desde {formatDateTime(p.criadoEm)}</p>
                </TableCell>
                <TableCell className="break-all">{p.email}</TableCell>
                <TableCell className="tabular text-right">{p.propostas}</TableCell>
                <TableCell className="tabular text-right">{p.aceites}</TableCell>
                <TableCell>
                  {/* Ícone + texto: situação nunca só por cor (DESIGN.md) */}
                  <span
                    className={
                      p.ativo
                        ? "inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-success-bg px-2.5 py-1 text-label text-success"
                        : "inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-danger-bg px-2.5 py-1 text-label text-danger"
                    }
                  >
                    {p.ativo ? "✓ Ativa" : "✕ Suspensa"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {p.ativo ? (
                    <ConfirmDialog
                      trigger={
                        <Button variant="secondary" size="sm">
                          Suspender<span className="sr-only"> {p.nome}</span>
                        </Button>
                      }
                      title="Suspender esta conta?"
                      description={`${p.nome} não conseguirá entrar nem criar propostas. Os links que já enviou continuam valendo para os clientes, e nada do que foi aceito muda.`}
                      confirmLabel="Suspender conta"
                      onConfirm={alterarSituacaoPrestador.bind(null, p.id, false)}
                    />
                  ) : (
                    <ConfirmDialog
                      trigger={
                        <Button variant="secondary" size="sm">
                          Reativar<span className="sr-only"> {p.nome}</span>
                        </Button>
                      }
                      title="Reativar esta conta?"
                      description={`${p.nome} volta a poder entrar e criar propostas.`}
                      confirmLabel="Reativar conta"
                      onConfirm={alterarSituacaoPrestador.bind(null, p.id, true)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
