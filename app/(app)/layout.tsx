import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/zelo/shell/app-shell";
import { requirePrestador } from "@/lib/auth/dal";

// Área do prestador. A checagem também é repetida em cada página/ação (layouts não
// são re-renderizados em toda navegação, então não podem ser a única barreira).
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requirePrestador();
  return (
    <AppShell profile={{ nome: profile.nome, empresaNome: profile.empresa_nome }}>
      {children}
      <Toaster />
    </AppShell>
  );
}
