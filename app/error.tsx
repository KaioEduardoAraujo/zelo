"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-h1 text-navy-950">Não conseguimos carregar esta página</h1>
      <p className="mt-3 text-slate-600">
        Aconteceu um problema do nosso lado. Seus dados não foram perdidos. Tente de novo em
        instantes.
      </p>
      <Button onClick={reset} className="mt-8 sm:self-start">
        Tentar de novo
      </Button>
    </main>
  );
}
