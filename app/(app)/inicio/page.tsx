import type { Metadata } from "next";

import { FormMessage } from "@/components/zelo/form-message";
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
      <h1 className="text-h1 text-navy-950">Olá, {profile.nome.split(" ")[0]}</h1>
      <p className="mt-2 text-slate-600">
        Seu painel com propostas e aceites chega nas próximas fases.
      </p>
    </>
  );
}
