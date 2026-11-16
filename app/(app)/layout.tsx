import { SessionHeader } from "@/components/zelo/session-header";
import { requirePrestador } from "@/lib/auth/dal";

// Área do prestador. A checagem também é repetida em cada página/ação (layouts não
// são re-renderizados em toda navegação, então não podem ser a única barreira).
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requirePrestador();
  return (
    <div className="min-h-dvh">
      <SessionHeader name={profile.nome} home="/inicio" />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
