"use server";

import { redirect } from "next/navigation";

import { homeFor } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/auth/routes";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth";

// Mensagens de erro não revelam se um e-mail está cadastrado.

export type FormState = {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
  values?: Record<string, string>;
};

const text = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};

const MENSAGEM_SUSPENSA =
  "Sua conta está suspensa. Fale com o administrador do Zelo para reativá-la. Os links de propostas já enviados continuam funcionando para os seus clientes.";

function authErrorMessage(code: string | undefined): string {
  // Conta suspensa também é banida no Auth: o login falha com este código.
  if (code === "user_banned") return MENSAGEM_SUSPENSA;
  if (code === "email_not_confirmed")
    return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (code?.startsWith("over_"))
    return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  return "E-mail ou senha incorretos.";
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: text(formData, "email") };
  const parsed = loginSchema.safeParse({
    email: values.email,
    password: text(formData, "password"),
    next: text(formData, "next"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) return { message: authErrorMessage(error?.code), values };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, ativo")
    .eq("id", data.user.id)
    .single();

  if (!profile?.ativo) {
    await supabase.auth.signOut();
    return { message: MENSAGEM_SUSPENSA, values };
  }

  redirect(safeNextPath(parsed.data.next, homeFor(profile)));
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    nome: text(formData, "nome"),
    empresa_nome: text(formData, "empresa_nome"),
    telefone: text(formData, "telefone"),
    email: text(formData, "email"),
  };
  const parsed = signupSchema.safeParse({ ...values, password: text(formData, "password") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const { email, password, ...metadata } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // O trigger handle_new_user ignora um "role" mandado aqui.
      data: metadata,
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/confirm?next=/inicio`,
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return {
        errors: { password: "Senha fraca. Use letras e números, com pelo menos 8 caracteres." },
        values,
      };
    }
    if (error.code?.startsWith("over_")) {
      return {
        message: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
        values,
      };
    }
    return {
      message:
        "Não foi possível criar a conta com esses dados. Confira o e-mail ou entre na sua conta.",
      values,
    };
  }

  if (data.session) redirect("/inicio");

  return {
    ok: true,
    message: "Enviamos um link de confirmação para o seu e-mail. Abra o link para ativar a conta.",
  };
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { email: text(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/redefinir-senha`,
  });

  if (error?.code?.startsWith("over_")) {
    return { message: "Muitos pedidos seguidos. Espere alguns minutos e tente de novo.", values };
  }

  return {
    ok: true,
    message:
      "Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha. O link vale por 1 hora.",
  };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { message: "Este link expirou. Peça um novo em “Esqueci minha senha”." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { errors: { password: "Escolha uma senha diferente da anterior." } };
    }
    if (error.code === "weak_password") {
      return {
        errors: { password: "Senha fraca. Use letras e números, com pelo menos 8 caracteres." },
      };
    }
    return { message: "Não conseguimos salvar a nova senha agora. Tente de novo." };
  }

  redirect("/inicio?senha=redefinida");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
