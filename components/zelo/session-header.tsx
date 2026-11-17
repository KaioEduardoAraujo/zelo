import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/zelo/logo";
import { logout } from "@/lib/auth/actions";

export function SessionHeader({ name, home }: { name: string; home: string }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href={home} aria-label="Zelo, início" className="rounded-[var(--radius-control)]">
          <Logo height={28} />
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-support text-slate-600 sm:inline">{name}</span>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
