import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-surface px-4 py-4 shadow-[var(--shadow-hairline)] md:px-5",
        className,
      )}
    >
      <p className="text-support text-slate-600">{label}</p>
      <p className="tabular mt-1 text-h1 text-navy-950">{value}</p>
      {hint && <p className="mt-1 text-support text-slate-600">{hint}</p>}
    </div>
  );
}
