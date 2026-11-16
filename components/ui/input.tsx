import * as React from "react";

import { cn } from "@/lib/utils";

// Input no padrão do DESIGN.md (seção 6): 48px de altura, fonte de 16px (sem zoom no iOS),
// borda line-strong em repouso, anel teal de 2px no foco e borda vermelha quando inválido.
function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3.5 text-base text-navy-900 transition-colors duration-150 ease-out outline-none placeholder:text-slate-600/70",
        "focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/30 focus-visible:outline-none",
        "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/25",
        "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
