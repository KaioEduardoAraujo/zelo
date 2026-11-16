"use client";

import { useActionState } from "react";

import { FormField } from "@/components/zelo/form-field";
import { FormMessage } from "@/components/zelo/form-message";
import { PasswordInput } from "@/components/zelo/password-input";
import { SubmitButton } from "@/components/zelo/submit-button";
import { resetPassword, type FormState } from "@/lib/auth/actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, {});

  return (
    <form action={action} noValidate className="mt-8 flex flex-col gap-5">
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <FormField
        id="password"
        label="Nova senha"
        hint="Pelo menos 8 caracteres, com letras e números."
        error={state.errors?.password}
      >
        {(a11y) => <PasswordInput {...a11y} name="password" autoComplete="new-password" required />}
      </FormField>
      <FormField id="confirm" label="Repita a nova senha" error={state.errors?.confirm}>
        {(a11y) => <PasswordInput {...a11y} name="confirm" autoComplete="new-password" required />}
      </FormField>
      <SubmitButton pending={pending} pendingLabel="Salvando…">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
