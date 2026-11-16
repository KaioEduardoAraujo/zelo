"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { FormField } from "@/components/zelo/form-field";
import { FormMessage } from "@/components/zelo/form-message";
import { PasswordInput } from "@/components/zelo/password-input";
import { SubmitButton } from "@/components/zelo/submit-button";
import { signup, type FormState } from "@/lib/auth/actions";

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signup, {});

  if (state.ok && state.message) {
    return (
      <FormMessage tone="success" className="mt-8">
        {state.message}
      </FormMessage>
    );
  }

  const v = state.values ?? {};
  const e = state.errors ?? {};

  return (
    <form action={action} noValidate className="mt-8 flex flex-col gap-5">
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}

      <FormField id="nome" label="Seu nome" error={e.nome}>
        {(a11y) => (
          <Input {...a11y} name="nome" autoComplete="name" defaultValue={v.nome} required />
        )}
      </FormField>

      <FormField id="empresa_nome" label="Nome da empresa" optional error={e.empresa_nome}>
        {(a11y) => (
          <Input
            {...a11y}
            name="empresa_nome"
            autoComplete="organization"
            defaultValue={v.empresa_nome}
          />
        )}
      </FormField>

      <FormField
        id="telefone"
        label="WhatsApp com DDD"
        optional
        hint="Aparece para o cliente no botão “Tenho dúvidas”."
        error={e.telefone}
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(11) 98765-4321"
            defaultValue={v.telefone}
          />
        )}
      </FormField>

      <FormField id="email" label="E-mail" error={e.email}>
        {(a11y) => (
          <Input
            {...a11y}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={v.email}
            required
          />
        )}
      </FormField>

      <FormField
        id="password"
        label="Senha"
        hint="Pelo menos 8 caracteres, com letras e números."
        error={e.password}
      >
        {(a11y) => <PasswordInput {...a11y} name="password" autoComplete="new-password" required />}
      </FormField>

      <SubmitButton pending={pending} pendingLabel="Criando conta…">
        Criar conta
      </SubmitButton>

      <p className="text-center text-support text-slate-600">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="font-semibold text-teal-600 underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
