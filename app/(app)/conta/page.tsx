import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/zelo/page-header";
import { logout } from "@/lib/auth/actions";
import { requirePrestador } from "@/lib/auth/dal";
import { maskPhone } from "@/lib/masks";

export const metadata: Metadata = { title: "Conta" };

export default async function ContaPage() {
  const profile = await requirePrestador();
  const rows = [
    ["Nome", profile.nome],
    ["Empresa", profile.empresa_nome ?? "Não informada"],
    ["E-mail", profile.email],
    ["WhatsApp", profile.telefone ? maskPhone(profile.telefone) : "Não informado"],
  ];

  return (
    <>
      <PageHeader title="Conta" />
      <dl className="max-w-[var(--container-doc)] divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 px-4 py-3.5 md:flex-row md:gap-6 md:px-6"
          >
            <dt className="text-support text-slate-600 md:w-32">{label}</dt>
            <dd className="text-navy-900">{value}</dd>
          </div>
        ))}
      </dl>
      <form action={logout} className="mt-6 lg:hidden">
        <Button type="submit" variant="secondary" className="w-full">
          Sair da conta
        </Button>
      </form>
    </>
  );
}
