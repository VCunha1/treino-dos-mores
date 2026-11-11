import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/services/session";
import type { Exercise, PlanDay, PlanDetail, PlanExercise, WorkoutPlan } from "@/types/training";

const PLAN_COLUMNS = "id, owner_id, created_by, name, description, goal, split_type, is_archived, is_shared, updated_at";
const EXERCISE_COLUMNS =
  "id, owner_id, name, primary_muscle, secondary_muscles, equipment, description, instructions, safety_notes, media_url";

/** Planos visíveis ao usuário (os dele, os que ele gerencia e os compartilhados com ele). A RLS decide. */
export async function listPlans(): Promise<WorkoutPlan[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_plans")
    .select(PLAN_COLUMNS)
    .order("is_archived", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar os planos.");
  return (data ?? []) as WorkoutPlan[];
}

export async function getPlan(planId: string): Promise<PlanDetail | null> {
  await requireUser();
  const supabase = await createClient();

  const { data: plan } = await supabase.from("workout_plans").select(PLAN_COLUMNS).eq("id", planId).maybeSingle();
  if (!plan) return null;

  const { data: days } = await supabase
    .from("workout_plan_days")
    .select("id, plan_id, name, weekday, focus, position")
    .eq("plan_id", planId)
    .order("position", { ascending: true });

  const dayIds = (days ?? []).map((d) => d.id);
  let items: PlanExercise[] = [];
  if (dayIds.length > 0) {
    const { data } = await supabase
      .from("workout_plan_exercises")
      .select(
        "id, day_id, exercise_id, position, sets, reps, initial_load_kg, rest_seconds, notes, special_technique, objective, exercise:exercises(id, name, primary_muscle, equipment)",
      )
      .in("day_id", dayIds)
      .order("position", { ascending: true });
    items = (data ?? []) as unknown as PlanExercise[];
  }

  const fullDays: PlanDay[] = (days ?? []).map((d) => ({
    ...d,
    exercises: items.filter((i) => i.day_id === d.id),
  }));

  return { ...(plan as WorkoutPlan), days: fullDays };
}

export async function listExercises(filters: { muscle?: string; q?: string } = {}): Promise<Exercise[]> {
  await requireUser();
  const supabase = await createClient();
  let query = supabase.from("exercises").select(EXERCISE_COLUMNS).order("name", { ascending: true }).limit(300);
  if (filters.muscle) query = query.eq("primary_muscle", filters.muscle);
  if (filters.q) {
    // Remove caracteres que têm significado na sintaxe do filtro PostgREST.
    const safe = filters.q.replace(/[%_,()*\\]/g, " ").trim().slice(0, 60);
    if (safe) query = query.ilike("name", `%${safe}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar os exercícios.");
  return (data ?? []) as Exercise[];
}
