import { FileText, House, LayoutTemplate, Plus, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Navegação do prestador (DESIGN.md 7.1): 4 itens + ação central "Nova proposta". */
export const NAV_ITEMS: NavItem[] = [
  { href: "/inicio", label: "Início", icon: House },
  { href: "/propostas", label: "Propostas", icon: FileText },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/conta", label: "Conta", icon: UserRound },
];

export const NEW_PROPOSAL: NavItem = {
  href: "/propostas/nova",
  label: "Nova proposta",
  icon: Plus,
};

/** Item ativo: rota exata ou subrota — exceto /propostas/nova, que tem destaque próprio. */
export function isActive(pathname: string, href: string) {
  if (pathname.startsWith(NEW_PROPOSAL.href)) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Telas de "modo foco" (assistente e editor de modelo): sem navegação inferior no celular, para
 * a barra de ações "Voltar / Continuar" ser a única coisa fixa no rodapé.
 */
export function isFocusMode(pathname: string) {
  return (
    /^\/propostas\/(nova|[^/]+\/editar)\/?$/.test(pathname) ||
    /^\/templates\/[^/]+\/editar\/?$/.test(pathname)
  );
}

/** Título da página na barra superior do mobile. */
export function pageTitle(pathname: string) {
  if (pathname.startsWith(NEW_PROPOSAL.href)) return NEW_PROPOSAL.label;
  if (/^\/propostas\/[^/]+\/editar/.test(pathname)) return "Editar proposta";
  if (/^\/propostas\/[^/]+\/?$/.test(pathname)) return "Proposta";
  if (/^\/templates\/[^/]+\/editar/.test(pathname)) return "Editar modelo";
  return NAV_ITEMS.find((i) => isActive(pathname, i.href))?.label ?? "Zelo";
}
