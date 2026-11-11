"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import {
  newPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";
import { fieldErrors, formString } from "@/lib/validation/helpers";
import type { ActionState } from "@/types";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada."
          : "E-mail ou senha incorretos.",
    };
  }
  redirect("/");
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    displayName: formString(formData, "displayName"),
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=/`,
    },
  });

  if (error) {
    // Registra só o código e a mensagem do Supabase (nunca a senha) para facilitar o diagnóstico.
    console.error("[signUp] falhou:", error.code, error.message);
    if (error.code === "weak_password") return { fieldErrors: { password: "Senha muito fraca. Escolha outra." } };
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { error: "Já existe uma conta com esse e-mail. Tente entrar." };
    }
    if (error.code === "over_email_send_rate_limit") {
      return { error: "Muitos e-mails enviados em pouco tempo. Aguarde alguns minutos e tente de novo." };
    }
    if (error.code === "signup_disabled") {
      return { error: "Novos cadastros estão desativados neste projeto." };
    }
    return { error: "Não foi possível criar a conta. Verifique os dados e tente novamente." };
  }

  // Com confirmação de e-mail ativa, não há sessão até o usuário confirmar.
  if (!data.session) {
    return { success: "Conta criada! Enviamos um link de confirmação para o seu e-mail." };
  }
  redirect("/");
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetRequestSchema.safeParse({ email: formString(formData, "email") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/redefinir-senha`,
  });

  // Resposta idêntica exista ou não a conta, para não revelar quais e-mails estão cadastrados.
  return { success: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse({
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "O link expirou. Solicite a redefinição novamente." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Não foi possível atualizar a senha. Tente novamente." };

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
