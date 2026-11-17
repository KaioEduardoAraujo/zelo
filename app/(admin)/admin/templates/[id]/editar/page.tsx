import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { carregarModeloGlobal } from "@/lib/admin/queries";

import { TemplateEditor } from "@/app/(app)/templates/[id]/editar/template-editor";

export const metadata: Metadata = { title: "Editar modelo global" };

export default async function EditarModeloGlobalPage(
  props: PageProps<"/admin/templates/[id]/editar">,
) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const modelo = await carregarModeloGlobal(id);
  if (!modelo) notFound();
  return (
    <TemplateEditor
      admin
      id={modelo.id}
      titulo={modelo.titulo}
      nicho={modelo.nicho}
      conteudo={modelo.conteudo}
    />
  );
}
