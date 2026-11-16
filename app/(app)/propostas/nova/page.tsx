import type { Metadata } from "next";
import Link from "next/link";

import { Stepper } from "@/components/zelo/proposal/stepper";
import { requirePrestador } from "@/lib/auth/dal";
import { NICHOS } from "@/lib/nichos";
import { listarModelos } from "@/lib/proposals/queries";

import { NovaPropostaForm, type ModeloOpcao } from "./nova-proposta-form";

export const metadata: Metadata = { title: "Nova proposta" };

export default async function NovaPropostaPage(props: PageProps<"/propostas/nova">) {
  await requirePrestador();
  const { modelo } = await props.searchParams;
  const modelos = await listarModelos();

  // Os seus modelos primeiro; depois os do Zelo.
  const opcoes: ModeloOpcao[] = [...modelos]
    .sort((a, b) => Number(b.proprio) - Number(a.proprio))
    .map((m) => ({
      id: m.id,
      titulo: m.titulo,
      nicho: NICHOS[m.nicho],
      proprio: m.proprio,
      escopo: m.conteudo.escopo,
      itens: m.conteudo.itens.length,
      totalCentavos: m.conteudo.valor_total_centavos,
    }));

  const pedido = typeof modelo === "string" ? modelo : undefined;
  const preselecionado =
    pedido === "zero" || opcoes.some((o) => o.id === pedido) ? pedido : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-h1 text-navy-950 max-lg:sr-only">Nova proposta</h1>
        <Link
          href="/propostas"
          className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] text-support font-semibold text-navy-700 hover:text-navy-950"
        >
          Cancelar
        </Link>
      </div>
      <Stepper atual={1} />
      <NovaPropostaForm modelos={opcoes} preselecionado={preselecionado} />
    </div>
  );
}
