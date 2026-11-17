import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  showTitleOnMobile = false,
  className,
}: {
  title: string;
  showTitleOnMobile?: boolean;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div>
        <h1 className={cn("text-h1 text-navy-950", !showTitleOnMobile && "max-lg:sr-only")}>
          {title}
        </h1>
        {description && <p className="mt-1.5 text-slate-600">{description}</p>}
      </div>
      {action && <div className="hidden md:block">{action}</div>}
    </div>
  );
}
