import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/zelo/empty-state";
import { PageHeader } from "@/components/zelo/page-header";
import { requirePrestador } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Propostas" };

export default async function PropostasPage() {
  await requirePrestador();
  return (
    <>
      <PageHeader
        title="Propostas"
        action={
          <Button asChild>
            <Link href="/propostas/nova">Nova proposta</Link>
          </Button>
        }
      />
      {/* Fase 4: busca, filtros por status, cards (mobile) e tabela (desktop). */}
      <EmptyState
        title="Você ainda não enviou propostas."
        description="Quando enviar, elas aparecem aqui com o status de cada uma."
        action={{ label: "Criar a primeira", href: "/propostas/nova" }}
      />
    </>
  );
}
