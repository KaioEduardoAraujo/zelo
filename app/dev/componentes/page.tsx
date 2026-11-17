import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AcceptanceStamp } from "@/components/zelo/acceptance-stamp";
import { AuditTimeline, type AuditEvent } from "@/components/zelo/audit-timeline";
import { EmptyState } from "@/components/zelo/empty-state";
import { FormField } from "@/components/zelo/form-field";
import { FormMessage } from "@/components/zelo/form-message";
import { ProposalCard, type ProposalSummary } from "@/components/zelo/proposal-card";
import { StatusBadge } from "@/components/zelo/status-badge";
import { formatCentavos, formatRelative } from "@/lib/format";
import { STATUS_ORDER } from "@/lib/status";

import { MaskedFields, Overlays } from "./interactive";

export const metadata: Metadata = { title: "Componentes", robots: { index: false } };

const now = new Date("2026-11-16T12:00:00Z");
const propostas: ProposalSummary[] = [
  {
    id: "1",
    titulo: "Reforma do banheiro",
    clienteNome: "Mariana Costa",
    valorCentavos: 840_000,
    status: "aceita",
    atualizadoEm: "2026-11-15T17:32:00Z",
  },
  {
    id: "2",
    titulo: "Troca de tela iPhone 12",
    clienteNome: "Rafael Lima",
    valorCentavos: 97_000,
    status: "visualizada",
    atualizadoEm: "2026-11-16T09:10:00Z",
  },
  {
    id: "3",
    titulo: "Instalação de ar-condicionado split 12.000 BTUs",
    clienteNome: "Condomínio Jardim das Flores",
    valorCentavos: 144_000,
    status: "ajuste_solicitado",
    atualizadoEm: "2026-11-13T14:00:00Z",
  },
  {
    id: "4",
    titulo: "Identidade visual",
    clienteNome: "Padaria Pão de Mel",
    valorCentavos: null,
    status: "rascunho",
    atualizadoEm: "2026-11-16T11:40:00Z",
  },
];
const ua =
  "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const eventos: AuditEvent[] = [
  { id: "a", tipo: "enviada", criadoEm: "2026-11-12T13:05:00Z" },
  { id: "b", tipo: "aberta", criadoEm: "2026-11-12T17:20:00Z", ip: "177.92.40.18", userAgent: ua },
  {
    id: "c",
    tipo: "otp_enviado",
    criadoEm: "2026-11-12T17:29:00Z",
    ip: "177.92.40.18",
    userAgent: ua,
  },
  {
    id: "d",
    tipo: "otp_falhou",
    criadoEm: "2026-11-12T17:30:00Z",
    ip: "177.92.40.18",
    userAgent: ua,
  },
  {
    id: "e",
    tipo: "otp_verificado",
    criadoEm: "2026-11-12T17:31:00Z",
    ip: "177.92.40.18",
    userAgent: ua,
  },
  { id: "f", tipo: "aceita", criadoEm: "2026-11-12T17:32:00Z", ip: "177.92.40.18", userAgent: ua },
  { id: "g", tipo: "pdf_gerado", criadoEm: "2026-11-12T17:32:00Z" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="mb-5 text-h2 text-navy-900">{title}</h2>
      {children}
    </section>
  );
}

export default function ComponentesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <h1 className="text-display text-navy-950">Componentes</h1>
      <p className="mt-2 mb-6 text-slate-600">
        Vitrine do design system da Zelo (só em desenvolvimento).
      </p>

      <Section title="Tipografia">
        <div className="space-y-2">
          <p className="text-display">Display 32/44</p>
          <p className="text-h1">H1 título de página</p>
          <p className="text-h2">H2 seção</p>
          <p className="text-h3">H3 bloco</p>
          <p className="text-body">Corpo 16/26, para textos longos de escopo e condições.</p>
          <p className="text-support text-slate-600">Apoio 14/20</p>
          <p className="font-mono text-sm">3ef347c9e2d8a87969909bdcdb03290b · 12/11/2026 14:32</p>
          <p className="tabular text-h2">{formatCentavos(840_000)}</p>
        </div>
      </Section>

      <Section title="Botões">
        <div className="flex flex-wrap gap-3">
          <Button>Aceitar proposta</Button>
          <Button variant="secondary">Tenho dúvidas</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="destructive">Excluir rascunho</Button>
          <Button variant="link">Copiar link</Button>
          <Button disabled>Enviando…</Button>
        </div>
      </Section>

      <Section title="Status">
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section title="Selo de aceite">
        <div className="flex flex-wrap items-start gap-4">
          <AcceptanceStamp acceptedAt="12/11/2026 14:32" code="ZL-4K7Q-92MD" />
          <AcceptanceStamp acceptedAt="12/11/2026 14:32" code="ZL-4K7Q-92MD" size="lg" animate />
        </div>
      </Section>

      <Section title="Formulário">
        <div className="grid max-w-xl gap-5">
          <FormField id="demo-nome" label="Nome do cliente">
            {(a) => <Input {...a} defaultValue="Mariana Costa" />}
          </FormField>
          <FormField
            id="demo-email"
            label="E-mail do cliente"
            error="Confira o e-mail: parece que falta alguma parte."
          >
            {(a) => <Input {...a} defaultValue="mariana@" />}
          </FormField>
          <MaskedFields />
          <FormMessage tone="error">
            Não conseguimos salvar agora. Seus dados continuam aqui, tente de novo.
          </FormMessage>
          <FormMessage tone="success">Aceite registrado. Guarde o comprovante.</FormMessage>
        </div>
      </Section>

      <Section title="Cartões de proposta (mobile)">
        <div className="grid gap-3 md:grid-cols-2">
          {propostas.map((p) => (
            <ProposalCard key={p.id} proposal={p} now={now} />
          ))}
        </div>
      </Section>

      <Section title="Tabela (desktop)">
        <Table>
          <TableHeader>
            <TableRow className="h-11 hover:bg-transparent">
              <TableHead>Cliente</TableHead>
              <TableHead>Proposta</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Atualizada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {propostas.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold">{p.clienteNome}</TableCell>
                <TableCell>{p.titulo}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell className="tabular text-right">
                  {p.valorCentavos === null ? "—" : formatCentavos(p.valorCentavos)}
                </TableCell>
                <TableCell className="text-right text-slate-600">
                  {formatRelative(p.atualizadoEm, now)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Trilha de auditoria">
        <div className="max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-6">
          <AuditTimeline events={eventos} />
        </div>
      </Section>

      <Section title="Estado vazio e carregamento">
        <div className="grid gap-6 md:grid-cols-2">
          <EmptyState
            title="Nenhuma proposta por aqui ainda."
            description="Crie a primeira em 2 minutos."
            action={{ label: "Criar a primeira", href: "#" }}
          />
          <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        </div>
      </Section>

      <Section title="Diálogo, bottom sheet e toast">
        <Overlays />
      </Section>
    </main>
  );
}
