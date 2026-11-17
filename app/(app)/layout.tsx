import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/zelo/shell/app-shell";
import { requirePrestador } from "@/lib/auth/dal";

// A checagem se repete em cada página e ação: layouts não re-renderizam em toda navegação.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requirePrestador();
  return (
    <AppShell profile={{ nome: profile.nome, empresaNome: profile.empresa_nome }}>
      {children}
      <Toaster />
    </AppShell>
  );
}
