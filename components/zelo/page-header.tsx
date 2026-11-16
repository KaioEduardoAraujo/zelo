import { cn } from "@/lib/utils";

/** Título de página + ação principal (no desktop fica à direita do título). */
export function PageHeader({
  title,
  description,
  action,
  showTitleOnMobile = false,
  className,
}: {
  title: string;
  /** No mobile a barra superior já mostra o nome da página; o H1 fica só para leitores de tela. */
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
