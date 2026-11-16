import { SessionHeader } from "@/components/zelo/session-header";
import { requireAdmin } from "@/lib/auth/dal";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const profile = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <SessionHeader name={profile.nome} home="/admin" />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
