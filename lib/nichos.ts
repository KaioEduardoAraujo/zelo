import type { Enums } from "@/lib/supabase/database.types";

export type Nicho = Enums<"nicho">;

export const NICHOS: Record<Nicho, string> = {
  reforma: "Reforma",
  assistencia_tecnica: "Assistência técnica",
  design: "Design",
  agencia: "Agência",
  instalacao: "Instalação",
};

export const NICHO_ORDER = Object.keys(NICHOS) as Nicho[];
