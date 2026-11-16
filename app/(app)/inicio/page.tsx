import type { Metadata } from "next";

import { EmptyState } from "@/components/zelo/empty-state";
import { FormMessage } from "@/components/zelo/form-message";
import { PageHeader } from "@/components/zelo/page-header";
import { requirePrestador } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Início" };

export default async function InicioPage(props: PageProps<"/inicio">) {
  const profile = await requirePrestador();
  const { senha } = await props.searchParams;

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
      {/* Fase 4: números do mês, "Precisa de atenção" e propostas recentes. */}
      <EmptyState
        title="Nenhuma proposta por aqui ainda."
        description="Crie a primeira em 2 minutos a partir de um modelo do seu ramo."
        action={{ label: "Criar a primeira proposta", href: "/propostas/nova" }}
      />
    </>
  );
}
