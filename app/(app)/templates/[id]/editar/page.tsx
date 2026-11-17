import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requirePrestador } from "@/lib/auth/dal";
import { carregarModelo } from "@/lib/proposals/queries";

import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "Editar modelo" };

export default async function EditarModeloPage(props: PageProps<"/templates/[id]/editar">) {
  await requirePrestador();
  const { id } = await props.params;
  const modelo = await carregarModelo(id);

  if (!modelo.proprio) redirect("/templates");

  return (
    <TemplateEditor
      id={modelo.id}
      titulo={modelo.titulo}
      nicho={modelo.nicho}
      conteudo={modelo.conteudo}
    />
  );
}
