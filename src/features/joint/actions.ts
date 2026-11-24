"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formString } from "@/lib/validation/helpers";
import { jointErrorMessage } from "@/lib/validation/joint";
import { uuid } from "@/lib/validation/plan";

function fail(message: string): never {
  redirect(`/juntos?erro=${encodeURIComponent(message)}`);
}

type StartRow = { r_joint: string; r_session: string };

function firstRow(data: unknown): StartRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (row && typeof row === "object" && "r_session" in row && typeof (row as StartRow).r_session === "string") {
    return row as StartRow;
  }
  return null;
}

/** Chama a outra pessoa para treinar junto e já começa o treino de quem chamou. */
export async function startJoint(formData: FormData) {
  const day = uuid.safeParse(formString(formData, "dayId"));
  if (!day.success) fail("Escolha um treino.");

  const supabase = await createClient();
  // Quem pode treinar o quê, e a regra de um encontro por casal, ficam no banco.
  const { data, error } = await supabase.rpc("start_joint_session", { p_day: day.data });
  const row = firstRow(data);
  if (error || !row) fail(jointErrorMessage(error?.message));

  revalidatePath("/juntos");
  redirect(`/treino/${row.r_session}`);
}

/** A outra pessoa aceita o convite escolhendo o próprio treino. */
export async function joinJoint(formData: FormData) {
  const joint = uuid.safeParse(formString(formData, "jointId"));
  const day = uuid.safeParse(formString(formData, "dayId"));
  if (!joint.success) fail("Convite inválido.");
  if (!day.success) fail("Escolha o seu treino para entrar.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_joint_session", { p_joint: joint.data, p_day: day.data });
  const row = firstRow(data);
  if (error || !row) fail(jointErrorMessage(error?.message));

  revalidatePath("/juntos");
  redirect(`/treino/${row.r_session}`);
}

/** Desiste do convite (quem chamou) ou recusa (a outra pessoa). Os treinos individuais continuam. */
export async function cancelJoint(formData: FormData) {
  const joint = uuid.safeParse(formString(formData, "jointId"));
  if (!joint.success) fail("Convite inválido.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_joint_session", { p_joint: joint.data });
  if (error) fail(jointErrorMessage(error.message));

  revalidatePath("/juntos");
  redirect("/juntos");
}

/** Sai do encontro em andamento; o treino individual de quem saiu segue normalmente. */
export async function leaveJoint(formData: FormData) {
  const joint = uuid.safeParse(formString(formData, "jointId"));
  if (!joint.success) fail("Encontro inválido.");
  const session = uuid.safeParse(formString(formData, "sessionId"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_joint_session", { p_joint: joint.data });
  if (error) fail(jointErrorMessage(error.message));

  revalidatePath("/juntos");
  redirect(session.success ? `/treino/${session.data}` : "/juntos");
}
