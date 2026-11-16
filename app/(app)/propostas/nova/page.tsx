import type { Metadata } from "next";

import { EmptyState } from "@/components/zelo/empty-state";
import { PageHeader } from "@/components/zelo/page-header";
import { requirePrestador } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Nova proposta" };

export default async function NovaPropostaPage() {
  await requirePrestador();
  return (
    <>
      <PageHeader title="Nova proposta" />
      {/* Fase 4: assistente em 4 etapas com pré-visualização ao vivo. */}
      <EmptyState
        title="O assistente de criação chega na próxima fase."
        description="Você vai escolher um modelo, ajustar escopo e valores e revisar antes de enviar."
      />
    </>
  );
}
