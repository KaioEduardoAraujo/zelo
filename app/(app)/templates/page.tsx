import type { Metadata } from "next";

import { EmptyState } from "@/components/zelo/empty-state";
import { PageHeader } from "@/components/zelo/page-header";
import { requirePrestador } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  await requirePrestador();
  return (
    <>
      <PageHeader
        title="Templates"
        description="Modelos prontos por ramo, que você pode duplicar e ajustar."
      />
      {/* Fase 4: listar globais e próprios, duplicar e personalizar. */}
      <EmptyState title="Os modelos aparecem aqui na próxima fase." />
    </>
  );
}
