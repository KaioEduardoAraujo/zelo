import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full min-w-0 resize-y rounded-[var(--radius-control)] border border-line-strong bg-surface px-3.5 py-3 text-base leading-6 text-navy-900 transition-colors duration-150 ease-out outline-none placeholder:text-slate-600/70",
        "focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/30 focus-visible:outline-none",
        "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/25",
        "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
