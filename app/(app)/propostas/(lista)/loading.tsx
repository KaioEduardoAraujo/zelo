import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando propostas">
      <Skeleton className="mb-8 hidden h-9 w-48 lg:block" />
      <Skeleton className="mb-4 h-12 max-w-xl" />
      <div className="mb-6 flex flex-wrap gap-2">
        {[24, 20, 28, 24, 20].map((w, i) => (
          <Skeleton key={i} className="h-11 rounded-full" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-[var(--radius-card)] md:h-14" />
        ))}
      </div>
    </div>
  );
}
