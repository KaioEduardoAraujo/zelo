import { cn } from "@/lib/utils";

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
