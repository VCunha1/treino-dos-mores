"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { coupleErrorMessage, coupleNameSchema, inviteCodeSchema } from "@/lib/validation/couple";
import { formString } from "@/lib/validation/helpers";
import type { ActionState } from "@/types";

export async function createCouple(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = coupleNameSchema.safeParse(formString(formData, "name") || "Nosso casal");
  if (!parsed.success) return { fieldErrors: { name: parsed.error.issues[0]?.message ?? "Nome inválido." } };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_couple", { p_name: parsed.data });
  if (error) return { error: coupleErrorMessage(error.message) };

  revalidatePath("/", "layout");
  return { success: "Casal criado! Agora gere um convite para a outra pessoa." };
}

export async function createInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const coupleId = formString(formData, "coupleId");
  const supabase = await createClient();
  // A autorização (ser admin do casal) é verificada dentro da função SQL, não aqui.
  const { error } = await supabase.rpc("create_invitation", { p_couple: coupleId });
  if (error) return { error: coupleErrorMessage(error.message) };

  revalidatePath("/casal");
  return { success: "Convite gerado. Ele não expira: vale até ser aceito ou revogado." };
}

export async function revokeInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation: formString(formData, "invitationId") });
  if (error) return { error: coupleErrorMessage(error.message) };

  revalidatePath("/casal");
  return { success: "Convite revogado." };
}

export async function acceptInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = inviteCodeSchema.safeParse(formString(formData, "code"));
  if (!parsed.success) return { fieldErrors: { code: parsed.error.issues[0]?.message ?? "Código inválido." } };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_code: parsed.data });
  if (error) return { error: coupleErrorMessage(error.message) };

  revalidatePath("/", "layout");
  redirect("/casal");
}

export async function leaveCouple(): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_couple");
  if (error) return { error: coupleErrorMessage(error.message) };

  revalidatePath("/", "layout");
  redirect("/casal");
}
