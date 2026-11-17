import Image from "next/image";

/**
 * Cabeçalho da página do cliente (DESIGN.md 7.2.7): o nome do prestador em destaque, "via Zelo"
 * discreto e o corte diagonal teal no canto (o motivo gráfico da marca, derivado do símbolo).
 */
export function CabecalhoPublico({
  nome,
  enviadaVia = "Proposta enviada via",
}: {
  nome: string;
  /** "Proposta enviada via", "Aditivo enviado via"... */
  enviadaVia?: string;
}) {
  return (
    <header className="relative overflow-hidden border-b border-line bg-surface">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-teal-500 [clip-path:polygon(62%_0,100%_0,100%_100%,22%_100%)] md:w-36"
      />
      <div className="relative mx-auto max-w-[var(--container-doc)] px-4 py-4 pr-28 md:py-5">
        <p className="text-h3 break-words text-navy-950">{nome}</p>
        <p className="mt-0.5 flex items-center gap-1 text-label text-slate-600">
          {enviadaVia}
          <Image src="/icon.svg" alt="" width={14} height={14} unoptimized className="ml-0.5" />
          Zelo
        </p>
      </div>
    </header>
  );
}
