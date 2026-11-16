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

/** Título da página na barra superior do mobile. */
export function pageTitle(pathname: string) {
  if (pathname.startsWith(NEW_PROPOSAL.href)) return NEW_PROPOSAL.label;
  return NAV_ITEMS.find((i) => isActive(pathname, i.href))?.label ?? "Zelo";
}
