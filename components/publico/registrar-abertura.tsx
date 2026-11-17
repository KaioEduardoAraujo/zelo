"use client";

import { useEffect } from "react";

import { registrarAbertura } from "@/lib/publico/actions";

// Registrado pelo navegador depois de carregar: a prévia de link do WhatsApp não roda JS e não
// pode marcar a proposta como visualizada.
export function RegistrarAbertura({ token }: { token: string }) {
  useEffect(() => {
    void registrarAbertura(token).catch(() => {});
  }, [token]);
  return null;
}
