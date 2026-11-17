import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/zelo/logo";

export const metadata: Metadata = { title: "Página não encontrada" };

// Também aparece para a proposta de outro prestador (o RLS a esconde).
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Logo height={32} className="mb-10" />
      <h1 className="text-h1 text-navy-950">Página não encontrada</h1>
      <p className="mt-3 text-slate-600">
        O endereço pode ter mudado, ou esta proposta não existe na sua conta. Confira o link e tente
        de novo.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/inicio">Ir para o início</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/propostas">Ver minhas propostas</Link>
        </Button>
      </div>
    </main>
  );
}
