"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { FormField } from "@/components/zelo/form-field";
import { FormMessage } from "@/components/zelo/form-message";
import { PasswordInput } from "@/components/zelo/password-input";
import { SubmitButton } from "@/components/zelo/submit-button";
import { login, type FormState } from "@/lib/auth/actions";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});

  return (
    <form action={action} noValidate className="mt-8 flex flex-col gap-5">
      {state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : (
        notice && <FormMessage tone="error">{notice}</FormMessage>
      )}
      {next && <input type="hidden" name="next" value={next} />}

      <FormField id="email" label="E-mail" error={state.errors?.email}>
        {(a11y) => (
          <Input
            {...a11y}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            defaultValue={state.values?.email}
            required
          />
        )}
      </FormField>

      <FormField id="password" label="Senha" error={state.errors?.password}>
        {(a11y) => (
          <PasswordInput {...a11y} name="password" autoComplete="current-password" required />
        )}
      </FormField>

      <Link
        href="/esqueci-senha"
        className="-mt-2 self-start rounded-sm text-support font-semibold text-teal-600 underline-offset-4 hover:underline"
      >
        Esqueci minha senha
      </Link>

      <SubmitButton pending={pending} pendingLabel="Entrando…">
        Entrar
      </SubmitButton>

      <p className="text-center text-support text-slate-600">
        Ainda não tem conta?{" "}
        <Link
          href="/cadastro"
          className="font-semibold text-teal-600 underline-offset-4 hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </form>
  );
}
