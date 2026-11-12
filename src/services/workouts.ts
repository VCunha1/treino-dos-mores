import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/services/session";
import type { SessionDetail, SessionExercise, UserPreferences, WorkoutSession, WorkoutSet } from "@/types/workout";

const SESSION_COLUMNS =
  "id, user_id, plan_id, day_id, plan_name, day_name, status, started_at, ended_at, notes, total_volume_kg, sets_completed";

function num(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

/** Sessão em andamento do usuário (no máximo uma, garantido por índice único no banco). */
export async function getActiveSession(): Promise<WorkoutSession | null> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_sessions")
    .select(SESSION_COLUMNS)
    .eq("status", "in_progress")
    .maybeSingle();
  return (data as WorkoutSession | null) ?? null;
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  await requireUser();
  const supabase = await createClient();

  const { data: session } = await supabase.from("workout_sessions").select(SESSION_COLUMNS).eq("id", sessionId).maybeSingle();
  if (!session) return null;

  const { data: exercises } = await supabase
    .from("workout_session_exercises")
    .select(
      "id, session_id, exercise_id, exercise_name, primary_muscle, position, planned_sets, planned_reps, planned_load_kg, rest_seconds, special_technique, plan_notes, status, notes",
    )
    .eq("session_id", sessionId)
    .order("position", { ascending: true });

  const ids = (exercises ?? []).map((e) => e.id);
  let sets: WorkoutSet[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from("workout_sets")
      .select("id, session_exercise_id, set_number, reps, load_kg, completed, completed_at")
      .in("session_exercise_id", ids)
      .order("set_number", { ascending: true });
    sets = (data ?? []).map((s) => ({ ...s, load_kg: num(s.load_kg) })) as WorkoutSet[];
  }

  const full: SessionExercise[] = (exercises ?? []).map((e) => ({
    ...(e as Omit<SessionExercise, "sets" | "planned_load_kg">),
    planned_load_kg: num(e.planned_load_kg),
    sets: sets.filter((s) => s.session_exercise_id === e.id),
  }));

  const s = session as WorkoutSession;
  return { ...s, total_volume_kg: num(s.total_volume_kg), exercises: full };
}

export async function listCompletedSessions(limit = 50): Promise<WorkoutSession[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_COLUMNS)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Não foi possível carregar o histórico.");
  return (data ?? []).map((s) => ({ ...s, total_volume_kg: num(s.total_volume_kg) })) as WorkoutSession[];
}

export async function getPreferences(): Promise<UserPreferences> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("weight_unit, default_rest_seconds, sound_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as UserPreferences | null) ?? { weight_unit: "kg", default_rest_seconds: 90, sound_enabled: false };
}
