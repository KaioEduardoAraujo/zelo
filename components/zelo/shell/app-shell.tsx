"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/zelo/logo";
import { logout } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

import { isActive, isFocusMode, NAV_ITEMS, NEW_PROPOSAL, pageTitle } from "./nav";

type ShellProfile = { nome: string; empresaNome: string | null };

/**
 * Shell do prestador (DESIGN.md 7.1).
 * Desktop (≥1024px): barra lateral CLARA de 240px — clara para a logo funcionar sem versão negativa.
 * Mobile: barra superior (símbolo + título) e navegação inferior com 4 itens + "Nova proposta".
 */
export function AppShell({
  profile,
  children,
}: {
  profile: ShellProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const foco = isFocusMode(pathname);

  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only z-[60] rounded-[var(--radius-control)] bg-surface px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>

      {/* Barra lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <Link
          href="/inicio"
          aria-label="Zelo, início"
          className="mx-5 mt-6 mb-6 self-start rounded-[var(--radius-control)]"
        >
          <Logo height={30} />
        </Link>
        <div className="px-3">
          <Button asChild className="w-full justify-start">
            <Link href={NEW_PROPOSAL.href}>
              <NEW_PROPOSAL.icon aria-hidden="true" />
              {NEW_PROPOSAL.label}
            </Link>
          </Button>
        </div>
        <nav aria-label="Principal" className="mt-4 flex-1 px-3">
          <ul className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-[0.9375rem] font-semibold transition-colors duration-150",
                      active
                        ? "bg-teal-50 text-navy-950"
                        : "text-navy-700 hover:bg-surface-2 hover:text-navy-900",
                    )}
                  >
                    <item.icon
                      className={cn("size-5", active ? "text-teal-600" : "text-slate-600")}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-line px-5 py-4">
          <p className="truncate text-support font-semibold text-navy-900">{profile.nome}</p>
          {profile.empresaNome && (
            <p className="truncate text-support text-slate-600">{profile.empresaNome}</p>
          )}
          <form action={logout} className="mt-2">
            <button
              type="submit"
              className="-ml-1 rounded-[var(--radius-control)] px-1 py-1 text-support font-semibold text-navy-700 hover:text-navy-950"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Barra superior (mobile) */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Link href="/inicio" aria-label="Zelo, início" className="rounded-[var(--radius-control)]">
          <Image src="/brand/symbol.svg" alt="" width={28} height={28} unoptimized />
        </Link>
        <p className="text-h3 text-navy-950">{pageTitle(pathname)}</p>
      </header>

      <main
        id="conteudo"
        className={cn(
          "px-4 pt-6 md:px-8 lg:pt-10 lg:pb-12 lg:pl-[calc(15rem+2rem)]",
          foco ? "pb-6" : "pb-28",
        )}
      >
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      {/* Navegação inferior (mobile). Some nas telas de modo foco (assistente). */}
      {!foco && (
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <ul className="grid h-16 grid-cols-5 items-center">
            {[NAV_ITEMS[0], NAV_ITEMS[1], NEW_PROPOSAL, NAV_ITEMS[2], NAV_ITEMS[3]].map((item) => {
              if (item.href === NEW_PROPOSAL.href) {
                return (
                  <li key={item.href} className="flex justify-center">
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      className="-mt-6 flex size-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-[var(--shadow-overlay)] transition-colors hover:bg-teal-700"
                    >
                      <item.icon className="size-6" strokeWidth={2} aria-hidden="true" />
                    </Link>
                  </li>
                );
              }
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href} className="flex justify-center">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-[0.75rem] font-semibold",
                      active ? "text-teal-600" : "text-slate-600",
                    )}
                  >
                    <item.icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
