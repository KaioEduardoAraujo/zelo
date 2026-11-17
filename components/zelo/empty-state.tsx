import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface px-5 py-10 text-center md:py-14",
        className,
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 32 32" className="mx-auto mb-4 size-8">
        <path
          d="M4 28 L28 4"
          stroke="var(--color-teal-500)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <p className="text-h3 text-navy-950">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-support text-slate-600">{description}</p>
      )}
      {action && (
        <Button asChild className="mt-6">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
