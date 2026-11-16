import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/** <select> nativo estilizado: no celular abre o seletor do próprio sistema (melhor que um custom). */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-12 w-full appearance-none rounded-[var(--radius-control)] border border-line-strong bg-surface pr-10 pl-3.5 text-base text-navy-900 outline-none",
          "focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/30",
          "aria-invalid:border-danger",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-slate-600"
        aria-hidden="true"
      />
    </div>
  );
}

export { NativeSelect };
