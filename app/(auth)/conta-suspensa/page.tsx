import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Conta suspensa" };

export default function SuspendedPage() {
  return (
    <>
      <h1 className="text-h1 text-navy-950">Sua conta está suspensa</h1>
      <p className="mt-3 text-slate-600">
        Enquanto a conta estiver suspensa, não é possível criar nem enviar propostas. Fale com o
        administrador do Zelo para reativá-la.
      </p>
      <p className="mt-3 text-slate-600">
        Os links de propostas que você já enviou continuam funcionando para os seus clientes.
      </p>
      <form action={logout} className="mt-8">
        <Button type="submit" variant="secondary" className="w-full">
          Sair
        </Button>
      </form>
    </>
  );
}
