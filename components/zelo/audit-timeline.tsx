import { formatDateTime } from "@/lib/format";
import { EVENTO, type EventoTipo } from "@/lib/status";
import { summarizeUserAgent } from "@/lib/user-agent";
import { cn } from "@/lib/utils";

export type AuditEvent = {
  id: string;
  tipo: EventoTipo;
  criadoEm: string;
  ip?: string | null;
  userAgent?: string | null;
};

const POSITIVE: EventoTipo[] = ["aceita", "otp_verificado", "pdf_gerado"];
const NEGATIVE: EventoTipo[] = ["recusada", "otp_falhou"];

/**
 * Trilha de auditoria (DESIGN.md 6): linha vertical fina, um ponto por evento,
 * hora em fonte mono. IP e dispositivo aparecem como dado de verdade, não escondidos.
 */
export function AuditTimeline({ events, className }: { events: AuditEvent[]; className?: string }) {
  if (events.length === 0) {
    return <p className="text-support text-slate-600">Nenhum evento registrado ainda.</p>;
  }

  return (
    <ol className={cn("relative", className)}>
      {events.map((event, i) => {
        const last = i === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-4 pb-5 last:pb-0">
            {!last && (
              <span
                aria-hidden="true"
                className="absolute top-4 bottom-0 left-[5px] w-px bg-line-strong"
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 bg-surface",
                POSITIVE.includes(event.tipo)
                  ? "border-teal-600 bg-teal-600"
                  : NEGATIVE.includes(event.tipo)
                    ? "border-danger"
                    : "border-navy-700",
              )}
            />
            <div className="min-w-0">
              <p className="text-support font-semibold text-navy-900">{EVENTO[event.tipo]}</p>
              <p className="font-mono text-xs leading-5 text-slate-600">
                <time dateTime={event.criadoEm}>{formatDateTime(event.criadoEm)}</time>
                {event.ip && <> · IP {event.ip}</>}
              </p>
              {event.userAgent && (
                <p className="text-xs leading-5 text-slate-600">
                  {summarizeUserAgent(event.userAgent)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
