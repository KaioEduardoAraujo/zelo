import { cn } from "@/lib/utils";

/** Bloco de carregamento. A animação some com prefers-reduced-motion (regra global). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-[var(--radius-control)] bg-neutral-bg", className)}
      {...props}
    />
  );
}

export { Skeleton };
