"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formString } from "@/lib/validation/helpers";
import { uuid } from "@/lib/validation/plan";
import {
  exerciseStatusSchema,
  finishSchema,
  preferencesSchema,
  setPatchSchema,
  workoutErrorMessage,
} from "@/lib/validation/workout";
import type { SaveSetResult } from "@/types/workout";

function fail(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

// ------------------------------------------------------------ iniciar / encerrar

export async function startSession(formData: FormData) {
  const planId = uuid.safeParse(formString(formData, "planId"));
  const dayId = uuid.safeParse(formString(formData, "dayId"));
  if (!planId.success || !dayId.success) fail("/treinos", "Identificador inválido.");
  const back = `/treinos/${planId.data}`;

  const supabase = await createClient();
  // A autorização (poder ver o plano) e a regra de uma sessão por vez ficam no banco.
  const { data, error } = await supabase.rpc("start_workout_session", { p_day: dayId.data });

  if (error?.message.includes("session_in_progress")) {
    const { data: active } = await supabase.from("workout_sessions").select("id").eq("status", "in_progress").maybeSingle();
    if (active?.id) redirect(`/treino/${active.id}?aviso=em-andamento`);
  }
  if (error || !data) fail(back, workoutErrorMessage(error?.message));

  revalidatePath("/treinos");
  redirect(`/treino/${String(data)}`);
}

export async function finishSession(formData: FormData) {
  const parsed = finishSchema.safeParse({
    sessionId: formString(formData, "sessionId"),
    notes: formString(formData, "notes"),
  });
  if (!parsed.success) fail("/treinos", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const back = `/treino/${parsed.data.sessionId}`;

  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_workout_session", {
    p_session: parsed.data.sessionId,
    p_notes: parsed.data.notes,
  });
  if (error) fail(back, workoutErrorMessage(error.message));

  revalidatePath("/", "layout");
  redirect(`/historico/${parsed.data.sessionId}?concluido=1`);
}

export async function discardSession(formData: FormData) {
  const sessionId = uuid.safeParse(formString(formData, "sessionId"));
  if (!sessionId.success) fail("/treinos", "Identificador inválido.");

  const supabase = await createClient();
  // Só apaga treino em andamento: sessões concluídas passam por deleteSession (histórico).
  const { data, error } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", sessionId.data)
    .eq("status", "in_progress")
    .select("id");
  if (error || !data?.length) fail(`/treino/${sessionId.data}`, "Não foi possível descartar o treino.");

  revalidatePath("/", "layout");
  redirect("/treinos");
}

export async function deleteSession(formData: FormData) {
  const sessionId = uuid.safeParse(formString(formData, "sessionId"));
  if (!sessionId.success) fail("/historico", "Identificador inválido.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_sessions").delete().eq("id", sessionId.data).select("id");
  if (error || !data?.length) fail("/historico", "Não foi possível excluir o treino.");

  revalidatePath("/historico");
  redirect("/historico");
}

// ---------------------------------------------------------- chamadas do cliente
// Estas funções são chamadas pelo navegador durante o treino (salvamento automático).
// Todas são idempotentes: repetir a mesma chamada após uma queda de conexão não duplica nada.

export async function saveSet(input: unknown): Promise<SaveSetResult> {
  const parsed = setPatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, final: true, error: "Dados da série inválidos." };
  const { setId, reps, loadKg, completed } = parsed.data;

  if (completed && reps === null) {
    return { ok: false, final: true, error: "Informe as repetições para concluir a série." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sets")
    .update({ reps, load_kg: loadKg, completed })
    .eq("id", setId)
    .select("id");

  if (error) return { ok: false, error: "Sem conexão com o servidor." };
  // Nenhuma linha: a sessão já foi finalizada/descartada ou a série não é do usuário. Não adianta repetir.
  if (!data?.length) return { ok: false, final: true, error: "Este treino não aceita mais alterações." };
  return { ok: true };
}

export async function addSet(
  sessionExerciseId: unknown,
): Promise<{ ok: true; set: { id: string; setNumber: number; loadKg: number | null } } | { ok: false; error: string }> {
  const id = uuid.safeParse(sessionExerciseId);
  if (!id.success) return { ok: false, error: "Identificador inválido." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("workout_sets")
    .select("set_number, load_kg")
    .eq("session_exercise_id", id.data)
    .order("set_number", { ascending: false })
    .limit(1);

  const nextNumber = (last?.[0]?.set_number ?? 0) + 1;
  if (nextNumber > 20) return { ok: false, error: "Limite de 20 séries por exercício." };

  const loadKg = last?.[0]?.load_kg === null || last?.[0]?.load_kg === undefined ? null : Number(last[0].load_kg);
  const { data, error } = await supabase
    .from("workout_sets")
    .insert({ session_exercise_id: id.data, set_number: nextNumber, load_kg: loadKg })
    .select("id, set_number, load_kg")
    .single();

  if (error || !data) return { ok: false, error: "Não foi possível adicionar a série. Tente novamente." };
  return { ok: true, set: { id: data.id, setNumber: data.set_number, loadKg: data.load_kg === null ? null : Number(data.load_kg) } };
}

export async function removeSet(setId: unknown): Promise<{ ok: boolean }> {
  const id = uuid.safeParse(setId);
  if (!id.success) return { ok: false };
  const supabase = await createClient();
  // Só séries ainda não concluídas podem ser removidas.
  const { data, error } = await supabase.from("workout_sets").delete().eq("id", id.data).eq("completed", false).select("id");
  return { ok: !error && Boolean(data?.length) };
}

export async function setExerciseStatus(input: unknown): Promise<{ ok: boolean }> {
  const parsed = exerciseStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_session_exercises")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.sessionExerciseId)
    .select("id");
  return { ok: !error && Boolean(data?.length) };
}

// ------------------------------------------------------------------ preferências

export async function updatePreferences(formData: FormData) {
  const parsed = preferencesSchema.safeParse({
    defaultRestSeconds: formString(formData, "defaultRestSeconds"),
    soundEnabled: formString(formData, "soundEnabled") === "on",
  });
  if (!parsed.success) fail("/configuracoes", parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("user_preferences")
    .update({ default_rest_seconds: parsed.data.defaultRestSeconds, sound_enabled: parsed.data.soundEnabled })
    .eq("user_id", user.id);
  if (error) fail("/configuracoes", "Não foi possível salvar as preferências.");

  revalidatePath("/configuracoes");
  redirect("/configuracoes?salvo=1");
}
