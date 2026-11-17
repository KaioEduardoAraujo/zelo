import Link from "next/link";

import { SessionHeader } from "@/components/zelo/session-header";
import { requireAdmin } from "@/lib/auth/dal";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const profile = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <SessionHeader name={profile.nome} home="/admin" />
      <nav aria-label="Administração" className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl gap-1 px-4 md:px-8">
          {[
            ["/admin", "Prestadores"],
            ["/admin/templates", "Templates"],
          ].map(([href, rotulo]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center px-3 text-support font-semibold text-navy-700 hover:text-navy-950"
            >
              {rotulo}
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
