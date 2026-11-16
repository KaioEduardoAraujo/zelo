import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Administração" };

export default async function AdminPage() {
  await requireAdmin();
  return (
    <>
      <h1 className="text-h1 text-navy-950">Administração</h1>
      <p className="mt-2 text-slate-600">
        A lista de prestadores, com ativar e suspender, chega na Fase 9.
      </p>
    </>
  );
}
