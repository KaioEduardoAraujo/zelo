"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { FormField } from "@/components/zelo/form-field";
import { FormMessage } from "@/components/zelo/form-message";
import { SubmitButton } from "@/components/zelo/submit-button";
import { requestPasswordReset, type FormState } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});

  return (
    <div className="mt-8 flex flex-col gap-5">
      {state.ok ? (
        <FormMessage tone="success">{state.message}</FormMessage>
      ) : (
        <form action={action} noValidate className="flex flex-col gap-5">
          {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
          <FormField id="email" label="E-mail" error={state.errors?.email}>
            {(a11y) => (
              <Input
                {...a11y}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                defaultValue={state.values?.email}
                required
              />
            )}
          </FormField>
          <SubmitButton pending={pending} pendingLabel="Enviando…">
            Enviar link
          </SubmitButton>
        </form>
      )}
      <Link
        href="/login"
        className="self-center text-support font-semibold text-teal-600 underline-offset-4 hover:underline"
      >
        Voltar para o login
      </Link>
    </div>
  );
}
