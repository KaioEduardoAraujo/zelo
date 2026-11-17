import { FileText, House, LayoutTemplate, Plus, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

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

export function isActive(pathname: string, href: string) {
  if (pathname.startsWith(NEW_PROPOSAL.href)) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isFocusMode(pathname: string) {
  return (
    /^\/propostas\/(nova|[^/]+\/editar)\/?$/.test(pathname) ||
    /^\/templates\/[^/]+\/editar\/?$/.test(pathname)
  );
}

export function pageTitle(pathname: string) {
  if (pathname.startsWith(NEW_PROPOSAL.href)) return NEW_PROPOSAL.label;
  if (/^\/propostas\/[^/]+\/editar/.test(pathname)) return "Editar proposta";
  if (/^\/propostas\/[^/]+\/?$/.test(pathname)) return "Proposta";
  if (/^\/templates\/[^/]+\/editar/.test(pathname)) return "Editar modelo";
  return NAV_ITEMS.find((i) => isActive(pathname, i.href))?.label ?? "Zelo";
}
