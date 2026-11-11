"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { splitDays } from "@/lib/training";
import { formString } from "@/lib/validation/helpers";
import {
  customExerciseSchema,
  dayUpdateSchema,
  planCreateSchema,
  planExerciseSchema,
  planUpdateSchema,
  uuid,
} from "@/lib/validation/plan";

/**
 * Todas as ações abaixo confiam na RLS e nas funções SQL para autorização:
 * o servidor nunca decide sozinho quem pode editar o quê. Em caso de erro,
 * voltamos à página de origem com ?erro=mensagem.
 */

function fail(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

function sqlMessage(error: { message?: string; code?: string } | null): string {
  const m = error?.message ?? "";
  if (m.includes("forbidden") || error?.code === "42501") return "Você não tem permissão para essa ação.";
  if (m.includes("invalid_days")) return "Um plano precisa ter entre 1 e 7 dias.";
  if (m.includes("row-level security")) return "Você não tem permissão para essa ação.";
  if (m.includes("duplicate key") || error?.code === "23505") return "Já existe um item com esse nome.";
  if (m.includes("violates foreign key") || error?.code === "23503") return "Este item está em uso e não pode ser removido.";
  return "Não foi possível concluir a ação. Tente novamente.";
}

function parseId(value: string, path: string): string {
  const r = uuid.safeParse(value);
  if (!r.success) fail(path, "Identificador inválido.");
  return r.data;
}

function planPath(planId: string) {
  return `/treinos/${planId}`;
}

// ------------------------------------------------------------------ planos

export async function createPlan(formData: FormData) {
  const parsed = planCreateSchema.safeParse({
    ownerId: formString(formData, "ownerId"),
    name: formString(formData, "name"),
    split: formString(formData, "split"),
    description: formString(formData, "description"),
  });
  if (!parsed.success) fail("/treinos/novo", parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workout_plan", {
    p_owner: parsed.data.ownerId,
    p_name: parsed.data.name,
    p_split: parsed.data.split,
    p_description: parsed.data.description,
    p_day_names: splitDays(parsed.data.split),
  });
  if (error || !data) fail("/treinos/novo", sqlMessage(error));

  revalidatePath("/treinos");
  redirect(planPath(String(data)));
}

export async function updatePlan(formData: FormData) {
  const planId = parseId(formString(formData, "planId"), "/treinos");
  const parsed = planUpdateSchema.safeParse({
    planId,
    name: formString(formData, "name"),
    description: formString(formData, "description"),
    goal: formString(formData, "goal"),
  });
  if (!parsed.success) fail(planPath(planId), parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_plans")
    .update({ name: parsed.data.name, description: parsed.data.description, goal: parsed.data.goal })
    .eq("id", planId)
    .select("id");
  if (error || !data?.length) fail(planPath(planId), sqlMessage(error));

  revalidatePath("/treinos");
  revalidatePath(planPath(planId));
  redirect(planPath(planId));
}

async function setPlanFlag(formData: FormData, column: "is_archived" | "is_shared") {
  const planId = parseId(formString(formData, "planId"), "/treinos");
  const value = formString(formData, "value") === "true";
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_plans").update({ [column]: value }).eq("id", planId).select("id");
  if (error || !data?.length) fail(planPath(planId), sqlMessage(error));
  revalidatePath("/treinos");
  revalidatePath(planPath(planId));
  redirect(column === "is_archived" && value ? "/treinos" : planPath(planId));
}

export async function setPlanArchived(formData: FormData) {
  return setPlanFlag(formData, "is_archived");
}

export async function setPlanShared(formData: FormData) {
  return setPlanFlag(formData, "is_shared");
}

export async function deletePlan(formData: FormData) {
  const planId = parseId(formString(formData, "planId"), "/treinos");
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_plans").delete().eq("id", planId).select("id");
  if (error || !data?.length) fail(planPath(planId), sqlMessage(error));
  revalidatePath("/treinos");
  redirect("/treinos");
}

export async function duplicatePlan(formData: FormData) {
  const planId = parseId(formString(formData, "planId"), "/treinos");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_workout_plan", { p_plan: planId, p_name: null });
  if (error || !data) fail(planPath(planId), sqlMessage(error));
  revalidatePath("/treinos");
  redirect(planPath(String(data)));
}

// -------------------------------------------------------------------- dias

export async function addDay(formData: FormData) {
  const planId = parseId(formString(formData, "planId"), "/treinos");
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("workout_plan_days")
    .select("position")
    .eq("plan_id", planId)
    .order("position", { ascending: false });
  if (readError) fail(planPath(planId), sqlMessage(readError));
  if ((existing?.length ?? 0) >= 7) fail(planPath(planId), "Um plano pode ter no máximo 7 dias.");

  const next = (existing?.[0]?.position ?? 0) + 1;
  const { error } = await supabase
    .from("workout_plan_days")
    .insert({ plan_id: planId, name: `Treino ${(existing?.length ?? 0) + 1}`, position: next });
  if (error) fail(planPath(planId), sqlMessage(error));

  revalidatePath(planPath(planId));
  redirect(planPath(planId));
}

export async function updateDay(formData: FormData) {
  const planId = parseId(formString(formData, "planId"), "/treinos");
  const parsed = dayUpdateSchema.safeParse({
    dayId: formString(formData, "dayId"),
    name: formString(formData, "name"),
    focus: formString(formData, "focus"),
    weekday: formString(formData, "weekday"),
  });
  if (!parsed.success) fail(planPath(planId), parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_plan_days")
    .update({ name: parsed.data.name, focus: parsed.data.focus, weekday: parsed.data.weekday })
    .eq("id", parsed.data.dayId)
    .select("id");
  if (error || !data?.length) fail(planPath(planId), sqlMessage(error));

  revalidatePath(planPath(planId));
  redirect(planPath(planId));
}

export async function deleteDay(formData: FormData) {
  const planId = parseId(formString(formData, "planId"), "/treinos");
  const dayId = parseId(formString(formData, "dayId"), planPath(planId));
  const supabase = await createClient();

  const { count } = await supabase
    .from("workout_plan_days")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId);
  if ((count ?? 0) <= 1) fail(planPath(planId), "O plano precisa ter pelo menos um dia.");

  const { data, error } = await supabase.from("workout_plan_days").delete().eq("id", dayId).select("id");
  if (error || !data?.length) fail(planPath(planId), sqlMessage(error));

  revalidatePath(planPath(planId));
  redirect(planPath(planId));
}

/** Troca a posição do dia com o vizinho e renumera 1..n para manter a ordem consistente. */
export async function moveDay(formData: FormData) {
  const planId = parseId(formString(formData, "planId"), "/treinos");
  const dayId = parseId(formString(formData, "dayId"), planPath(planId));
  const dir = formString(formData, "dir") === "up" ? -1 : 1;

  const supabase = await createClient();
  const { data: days, error } = await supabase
    .from("workout_plan_days")
    .select("id")
    .eq("plan_id", planId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !days) fail(planPath(planId), sqlMessage(error));

  const ids = days.map((d) => d.id);
  const from = ids.indexOf(dayId);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= ids.length) redirect(planPath(planId));

  const moved = ids.splice(from, 1)[0]!;
  ids.splice(to, 0, moved);
  for (let i = 0; i < ids.length; i++) {
    const { error: upError } = await supabase.from("workout_plan_days").update({ position: i + 1 }).eq("id", ids[i]!);
    if (upError) fail(planPath(planId), sqlMessage(upError));
  }

  revalidatePath(planPath(planId));
  redirect(planPath(planId));
}

// -------------------------------------------------------------- exercícios do dia

export async function addPlanExercise(formData: FormData) {
  const planId = parseId(formString(formData, "planId"), "/treinos");
  const dayId = parseId(formString(formData, "dayId"), planPath(planId));
  const exerciseId = parseId(formString(formData, "exerciseId"), planPath(planId));
  const back = `${planPath(planId)}/dia/${dayId}`;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("workout_plan_exercises")
    .select("position")
    .eq("day_id", dayId)
    .order("position", { ascending: false })
    .limit(1);

  const { error } = await supabase
    .from("workout_plan_exercises")
    .insert({ day_id: dayId, exercise_id: exerciseId, position: (last?.[0]?.position ?? 0) + 1 });
  if (error) fail(back, sqlMessage(error));

  revalidatePath(planPath(planId));
  redirect(`${planPath(planId)}?adicionado=1#dia-${dayId}`);
}

export async function updatePlanExercise(formData: FormData) {
  const planId = parseId(formString(formData, "planId"), "/treinos");
  const itemId = parseId(formString(formData, "itemId"), planPath(planId));
  const parsed = planExerciseSchema.safeParse({
    sets: formString(formData, "sets"),
    reps: formString(formData, "reps"),
    initialLoadKg: formString(formData, "initialLoadKg"),
    restSeconds: formString(formData, "restSeconds"),
    notes: formString(formData, "notes"),
    specialTechnique: formString(formData, "specialTechnique"),
    objective: formString(formData, "objective"),
  });
  if (!parsed.success) fail(planPath(planId), parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_plan_exercises")
    .update({
      sets: d.sets,
      reps: d.reps,
      initial_load_kg: d.initialLoadKg,
      rest_seconds: d.restSeconds,
      notes: d.notes,
      special_technique: d.specialTechnique,
      objective: d.objective,
    })
    .eq("id", itemId)
    .select("id");
  if (error || !data?.length) fail(planPath(planId), sqlMessage(error));

  revalidatePath(planPath(planId));
  redirect(planPath(planId));
}

export async function deletePlanExercise(formData: FormData) {
  const planId = parseId(formString(formData, "planId"), "/treinos");
  const itemId = parseId(formString(formData, "itemId"), planPath(planId));
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_plan_exercises").delete().eq("id", itemId).select("id");
  if (error || !data?.length) fail(planPath(planId), sqlMessage(error));
  revalidatePath(planPath(planId));
  redirect(planPath(planId));
}

export async function movePlanExercise(formData: FormData) {
  const planId = parseId(formString(formData, "planId"), "/treinos");
  const dayId = parseId(formString(formData, "dayId"), planPath(planId));
  const itemId = parseId(formString(formData, "itemId"), planPath(planId));
  const dir = formString(formData, "dir") === "up" ? -1 : 1;

  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("workout_plan_exercises")
    .select("id")
    .eq("day_id", dayId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !items) fail(planPath(planId), sqlMessage(error));

  const ids = items.map((i) => i.id);
  const from = ids.indexOf(itemId);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= ids.length) redirect(`${planPath(planId)}#dia-${dayId}`);

  const moved = ids.splice(from, 1)[0]!;
  ids.splice(to, 0, moved);
  for (let i = 0; i < ids.length; i++) {
    const { error: upError } = await supabase.from("workout_plan_exercises").update({ position: i + 1 }).eq("id", ids[i]!);
    if (upError) fail(planPath(planId), sqlMessage(upError));
  }

  revalidatePath(planPath(planId));
  redirect(`${planPath(planId)}#dia-${dayId}`);
}

// ------------------------------------------------------ exercícios personalizados

export async function createCustomExercise(formData: FormData) {
  const parsed = customExerciseSchema.safeParse({
    name: formString(formData, "name"),
    primaryMuscle: formString(formData, "primaryMuscle"),
    equipment: formString(formData, "equipment"),
    description: formString(formData, "description"),
    instructions: formString(formData, "instructions"),
    safetyNotes: formString(formData, "safetyNotes"),
    mediaUrl: formString(formData, "mediaUrl"),
  });
  const returnTo = formString(formData, "returnTo");
  const back = returnTo.startsWith("/treinos/") ? returnTo : "/exercicios";
  if (!parsed.success) fail(back, parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const d = parsed.data;
  // O dono é sempre o usuário da sessão.
  const { error } = await supabase.from("exercises").insert({
    owner_id: user.id,
    name: d.name,
    primary_muscle: d.primaryMuscle,
    equipment: d.equipment,
    description: d.description,
    instructions: d.instructions,
    safety_notes: d.safetyNotes,
    media_url: d.mediaUrl,
  });
  if (error) fail(back, sqlMessage(error));

  revalidatePath("/exercicios");
  redirect(back);
}

export async function deleteCustomExercise(formData: FormData) {
  const exerciseId = parseId(formString(formData, "exerciseId"), "/exercicios");
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").delete().eq("id", exerciseId).select("id");
  if (error) fail("/exercicios", sqlMessage(error));
  if (!data?.length) fail("/exercicios", "Você só pode remover exercícios criados por você.");
  revalidatePath("/exercicios");
  redirect("/exercicios");
}
